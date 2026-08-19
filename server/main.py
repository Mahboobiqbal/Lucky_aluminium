import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text

from config import settings, validate_settings
from database import async_session, engine
from models import Base
from models.user import User, UserPermission
from utils.auth import hash_password

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


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("UDYANA_HOST", "127.0.0.1" if os.environ.get("UDYANA_DESKTOP") else "0.0.0.0")
    port = int(os.environ.get("UDYANA_PORT", "8000"))
    uvicorn.run(app, host=host, port=port, reload=False, log_level="info")
