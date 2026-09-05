import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import inspect, select, text

from config import settings, validate_settings
from database import async_session, engine
from models import Base
from models.user import User, UserPermission
from utils.auth import hash_password


def _get_frontend_dir():
    import pathlib
    if getattr(sys, "frozen", False):
        meipass = pathlib.Path(sys._MEIPASS)
        exe_dir = pathlib.Path(sys.executable).parent
        candidates = [
            meipass / "frontend",
            exe_dir / "frontend",
            exe_dir / "_internal" / "frontend",
            meipass,
        ]
        for c in candidates:
            if c.is_dir():
                return c
        print(f"[DEBUG] Frontend not found. MEIPASS={meipass}, exe_dir={exe_dir}")
        print(f"[DEBUG] MEIPASS contents: {list(meipass.iterdir()) if meipass.is_dir() else 'NOT DIR'}")
        return None
    else:
        base = pathlib.Path(__file__).resolve().parent.parent
        for c in [base / ".output" / "public", base / "dist"]:
            if c.is_dir():
                return c
    return None

from routers import (
    auth,
    backup,
    customers,
    expenses,
    inventory,
    invoices,
    measurements,
    orders,
    payments,
    permissions,
    products,
    purchases,
    quotations,
    reports,
    settings as settings_router,
    suppliers,
    users,
)

logger = logging.getLogger(__name__)

MODULES = [
    "dashboard", "customers", "quotations", "orders", "invoices",
    "payments", "paymentReceipts", "purchase", "suppliers", "products",
    "measurements", "inventory", "expenses", "reports",
    "dailyPaymentStatement", "settings", "backup",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_settings()

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _ensure_columns(sync_conn):
            inspector = inspect(sync_conn)
            tables = set(inspector.get_table_names())
            if "purchase_items" in tables:
                purchase_item_columns = {c["name"] for c in inspector.get_columns("purchase_items")}
                if "width_ft" not in purchase_item_columns:
                    sync_conn.execute(text("ALTER TABLE purchase_items ADD COLUMN width_ft REAL DEFAULT 0"))
                if "height_ft" not in purchase_item_columns:
                    sync_conn.execute(text("ALTER TABLE purchase_items ADD COLUMN height_ft REAL DEFAULT 0"))
            if "inventory" in tables:
                inventory_columns = {c["name"] for c in inspector.get_columns("inventory")}
                if "width_ft" not in inventory_columns:
                    sync_conn.execute(text("ALTER TABLE inventory ADD COLUMN width_ft REAL DEFAULT 0"))
                if "height_ft" not in inventory_columns:
                    sync_conn.execute(text("ALTER TABLE inventory ADD COLUMN height_ft REAL DEFAULT 0"))
                if "stock_qty" not in inventory_columns:
                    sync_conn.execute(text("ALTER TABLE inventory ADD COLUMN stock_qty REAL DEFAULT 0"))
            if "orders" in tables:
                order_columns = {c["name"] for c in inspector.get_columns("orders")}
                if "previous_balance" not in order_columns:
                    sync_conn.execute(text("ALTER TABLE orders ADD COLUMN previous_balance REAL DEFAULT 0"))
            if "quotations" in tables:
                quotation_columns = {c["name"] for c in inspector.get_columns("quotations")}
                if "previous_balance" not in quotation_columns:
                    sync_conn.execute(text("ALTER TABLE quotations ADD COLUMN previous_balance REAL DEFAULT 0"))
            if "customers" in tables:
                customer_columns = {c["name"] for c in inspector.get_columns("customers")}
                if "previous_balance" not in customer_columns:
                    sync_conn.execute(text("ALTER TABLE customers ADD COLUMN previous_balance REAL DEFAULT 0"))
        await conn.run_sync(_ensure_columns)

    # Seed the single admin user from environment variables
    async with async_session() as db:
        admin_count = await db.execute(select(User).where(User.role == "admin"))
        existing_admins = admin_count.scalars().all()

        if len(existing_admins) == 0:
            admin = User(
                full_name="Lucky Aluminium",
                username=settings.INITIAL_ADMIN_USERNAME,
                email=f"{settings.INITIAL_ADMIN_USERNAME}@luckyaluminium.local",
                phone="",
                password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
                status="active",
                role="admin",
            )
            db.add(admin)
            await db.flush()

            for mod in MODULES:
                db.add(UserPermission(
                    user_id=admin.id,
                    module_key=mod,
                    can_view=True,
                    can_create=True,
                    can_edit=True,
                    can_delete=True,
                    can_print=True,
                    can_export=True,
                ))

            await db.commit()
            logger.info("Admin user '%s' created from environment credentials", settings.INITIAL_ADMIN_USERNAME)
        elif len(existing_admins) > 1:
            logger.critical("CRITICAL: Multiple admin users detected (%d). Manual intervention required.", len(existing_admins))

    # Backfill: roll each order's previous_balance into its customer's running previous_balance.
    # Safe to re-run: subtracts the previously-applied roll first, then re-applies.
    async with async_session() as db:
        try:
            from models.customer import Customer
            from models.order import Order
            from sqlalchemy import update
            # Zero out customer.previous_balance and subtract each order's previous_balance from it
            await db.execute(update(Customer).values(previous_balance=0))
            await db.flush()
            # Now set each customer's previous_balance to the sum of its orders' previous_balance
            rows = await db.execute(
                select(Order.customer_id, func.coalesce(func.sum(Order.previous_balance), 0))
                .where(Order.customer_id.isnot(None))
                .group_by(Order.customer_id)
            )
            for cid, total_prev in rows.all():
                if not cid:
                    continue
                await db.execute(
                    update(Customer).where(Customer.id == cid).values(previous_balance=float(total_prev))
                )
            await db.commit()
        except Exception as e:
            logger.warning("Backfill of previous_balance failed: %s", e)
            await db.rollback()

    yield

app = FastAPI(title="UDYANA ERP API", version="1.0.0", lifespan=lifespan)

cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include all routers
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(products.router)
app.include_router(quotations.router)
app.include_router(orders.router)
app.include_router(invoices.router)
app.include_router(payments.router)
app.include_router(expenses.router)
app.include_router(suppliers.router)
app.include_router(purchases.router)
app.include_router(inventory.router)
app.include_router(measurements.router)
app.include_router(settings_router.router)
app.include_router(users.router)
app.include_router(permissions.router)
app.include_router(reports.router)
app.include_router(backup.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


frontend_dir = _get_frontend_dir()
if frontend_dir and frontend_dir.is_dir():
    assets_dir = frontend_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static-assets")

    index_html = frontend_dir / "index.html"

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path:
            file_path = frontend_dir / full_path
            if file_path.is_file():
                return FileResponse(str(file_path))
        return FileResponse(str(index_html))

    print(f"[Lucky Aluminium] Serving frontend from: {frontend_dir}")
else:
    print(f"[Lucky Aluminium] WARNING: Frontend directory not found. SPA will not work.")


if __name__ == "__main__":
    import uvicorn
    host = "127.0.0.1" if getattr(sys, "frozen", False) else os.environ.get("UDYANA_HOST", "0.0.0.0")
    port = int(os.environ.get("UDYANA_PORT", "8000"))
    uvicorn.run(app, host=host, port=port, reload=False, log_level="info")
