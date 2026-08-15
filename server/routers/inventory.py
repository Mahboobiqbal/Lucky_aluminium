from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.inventory import InventoryItem
from schemas.inventory import InventoryItemCreate, InventoryItemUpdate
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def _to_response(i: InventoryItem) -> dict:
    return {
        "id": i.id, "name": i.name, "category": i.category, "unit": i.unit,
        "itemType": i.item_type,
        "pricingMode": i.pricing_mode,
        "currentStock": float(i.current_stock), "minStock": float(i.min_stock),
        "costPrice": float(i.cost_price), "supplier": i.supplier,
        "widthFt": float(i.width_ft or 0), "heightFt": float(i.height_ft or 0),
        "length": float(i.length or 0),
        "stockQty": float(i.stock_qty or 0), "createdAt": i.created_at,
    }


@router.get("")
async def list_inventory(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("inventory", "view"))):
    result = await db.execute(select(InventoryItem).order_by(InventoryItem.name))
    return [_to_response(i) for i in result.scalars().all()]


@router.get("/{item_id}")
async def get_inventory_item(item_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("inventory", "view"))):
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return _to_response(item)


@router.post("")
async def create_inventory_item(body: InventoryItemCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("inventory", "create"))):
    item = InventoryItem(
        name=body.name, category=body.category, unit=body.unit,
        item_type=body.itemType, pricing_mode=body.pricingMode,
        current_stock=body.currentStock, min_stock=body.minStock,
        cost_price=body.costPrice, supplier=body.supplier,
        width_ft=body.widthFt, height_ft=body.heightFt, length=body.length,
        stock_qty=body.stockQty,
        created_at=datetime.utcnow(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_response(item)


@router.put("/{item_id}")
async def update_inventory_item(item_id: int, body: InventoryItemUpdate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("inventory", "edit"))):
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    item.name = body.name
    item.category = body.category
    item.unit = body.unit
    item.item_type = body.itemType
    item.pricing_mode = body.pricingMode
    item.current_stock = body.currentStock
    item.min_stock = body.minStock
    item.cost_price = body.costPrice
    item.supplier = body.supplier
    item.width_ft = body.widthFt
    item.height_ft = body.heightFt
    item.length = body.length
    item.stock_qty = body.stockQty

    await db.commit()
    await db.refresh(item)
    return _to_response(item)


@router.delete("/{item_id}")
async def delete_inventory_item(item_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("inventory", "delete"))):
    result = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Inventory item deleted", "success": True}
