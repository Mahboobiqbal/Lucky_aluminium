import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import Date, DateTime, delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.backup import Backup
from models.customer import Customer
from models.product import Product
from models.quotation import Quotation, QuotationItem
from models.order import Order, OrderItem
from models.invoice import Invoice, InvoiceItem
from models.payment import Payment
from models.expense import Expense
from models.supplier import Supplier
from models.purchase import Purchase, PurchaseItem
from models.inventory import InventoryItem
from models.measurement import Measurement
from models.setting import Setting
from models.user import User, UserPermission
from schemas.backup import BackupResponse
from utils.dates import naive
from utils.deps import require_permission, require_role

router = APIRouter(prefix="/api/backup", tags=["backup"])

ALL_TABLES = [
    ("customers", Customer),
    ("products", Product),
    ("quotations", Quotation),
    ("quotation_items", QuotationItem),
    ("orders", Order),
    ("order_items", OrderItem),
    ("invoices", Invoice),
    ("invoice_items", InvoiceItem),
    ("payments", Payment),
    ("expenses", Expense),
    ("suppliers", Supplier),
    ("purchases", Purchase),
    ("purchase_items", PurchaseItem),
    ("inventory", InventoryItem),
    ("measurements", Measurement),
    ("settings", Setting),
    ("users", User),
    ("user_permissions", UserPermission),
]


async def _export_all(db: AsyncSession) -> dict:
    data = {}
    for table_name, model in ALL_TABLES:
        result = await db.execute(select(model))
        rows = result.scalars().all()
        table_data = [
            {c.key: getattr(row, c.key) for c in model.__table__.columns}
            for row in rows
        ]
        if table_name == "users":
            for row_data in table_data:
                row_data.pop("password_hash", None)
        data[table_name] = table_data
    return data


@router.post("/export")
async def export_backup(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("backup", "export"))):
    data = await _export_all(db)
    json_str = json.dumps(data, default=str, indent=2)
    size = len(json_str.encode())

    backup = Backup(
        type="file",
        created_at=datetime.utcnow(),
        size=size,
        tables=", ".join(data.keys()),
        filename=f"backup-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json",
    )
    db.add(backup)
    await db.commit()

    return Response(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{backup.filename}"'},
    )


def _coerce_row(model, row: dict) -> dict:
    coerced = {}
    for col in model.__table__.columns:
        key = col.key
        if key not in row:
            continue
        value = row[key]
        if value is None or not isinstance(value, str):
            coerced[key] = value
            continue
        if isinstance(col.type, DateTime):
            try:
                coerced[key] = datetime.fromisoformat(value)
            except ValueError:
                try:
                    coerced[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                except ValueError:
                    coerced[key] = value
        elif isinstance(col.type, Date):
            try:
                coerced[key] = date.fromisoformat(value)
            except ValueError:
                coerced[key] = value
        else:
            coerced[key] = value
    return coerced


@router.post("/import")
async def import_backup(request: Request, db: AsyncSession = Depends(get_db), _user=Depends(require_role("admin"))):
    body = await request.json()
    if not isinstance(body, dict) or not body:
        raise HTTPException(status_code=400, detail="Backup file must be a JSON object with table data")

    table_map = dict(ALL_TABLES)
    for table_name, rows in body.items():
        if table_name not in table_map:
            raise HTTPException(status_code=400, detail=f"Unknown table in backup: {table_name}")
        if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
            raise HTTPException(status_code=400, detail=f"Table '{table_name}' must be an array of row objects")

    for table_name, rows in body.items():
        if table_name == "users":
            for row_data in rows:
                row_data.pop("password_hash", None)

    row_count = sum(len(rows) for rows in body.values())
    try:
        for table_name, _model in reversed(ALL_TABLES):
            await db.execute(delete(table_map[table_name]))
        for table_name, model in ALL_TABLES:
            rows = body.get(table_name, [])
            if rows:
                await db.execute(insert(model).values([_coerce_row(model, r) for r in rows]))
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Import failed: backup is not compatible with this version")

    return {"message": f"Restored {row_count} rows from backup", "success": True, "tables": len(body)}


@router.post("/snapshot", response_model=BackupResponse)
async def create_snapshot(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("backup", "create"))):
    data = await _export_all(db)
    json_str = json.dumps(data, default=str)
    size = len(json_str.encode())

    backup = Backup(
        type="snapshot",
        created_at=datetime.utcnow(),
        size=size,
        tables=", ".join(data.keys()),
        data=json_str,
    )
    db.add(backup)
    await db.commit()
    await db.refresh(backup)
    return backup


@router.get("/snapshots", response_model=list[BackupResponse])
async def list_snapshots(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("backup", "view"))):
    result = await db.execute(select(Backup).order_by(Backup.created_at.desc()))
    return result.scalars().all()


@router.delete("/{backup_id}")
async def delete_snapshot(backup_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("backup", "delete"))):
    result = await db.execute(select(Backup).where(Backup.id == backup_id))
    backup = result.scalar_one_or_none()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    await db.delete(backup)
    await db.commit()
    return {"message": "Backup deleted", "success": True}
