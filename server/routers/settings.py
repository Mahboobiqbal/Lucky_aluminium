from fastapi import APIRouter, Depends
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import engine, get_db
from models.backup import Backup
from models.customer import Customer
from models.expense import Expense
from models.inventory import InventoryItem
from models.invoice import Invoice, InvoiceItem
from models.measurement import Measurement
from models.order import Order, OrderItem
from models.payment import Payment
from models.product import Product
from models.purchase import Purchase, PurchaseItem
from models.quotation import Quotation, QuotationItem
from models.setting import Setting
from models.supplier import Supplier
from schemas.setting import SettingUpdate
from utils.deps import require_permission

router = APIRouter(prefix="/api/settings", tags=["settings"])

RESET_TABLES = [
    Backup,
    Customer,
    Expense,
    InventoryItem,
    InvoiceItem,
    Invoice,
    Measurement,
    OrderItem,
    Order,
    Payment,
    Product,
    PurchaseItem,
    Purchase,
    QuotationItem,
    Quotation,
    Setting,
    Supplier,
]


@router.get("")
async def list_settings(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("settings", "view"))):
    result = await db.execute(select(Setting))
    return [{"key": s.key, "value": s.value} for s in result.scalars().all()]


@router.put("")
async def update_settings(body: list[SettingUpdate], db: AsyncSession = Depends(get_db), _user=Depends(require_permission("settings", "edit"))):
    for item in body:
        result = await db.execute(select(Setting).where(Setting.key == item.key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = item.value
        else:
            db.add(Setting(key=item.key, value=item.value))

    await db.commit()
    return {"message": "Settings updated", "success": True}


@router.post("/reset")
async def reset_all_data(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("settings", "edit"))):
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys = OFF"))
        for model in reversed(RESET_TABLES):
            await conn.execute(delete(model))
        seq_exists = await conn.execute(
            text("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'")
        )
        if seq_exists.scalar():
            await conn.execute(text("DELETE FROM sqlite_sequence"))
        await conn.execute(text("PRAGMA foreign_keys = ON"))

    await db.commit()
    return {"message": "All data reset", "success": True}
