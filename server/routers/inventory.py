from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.inventory import InventoryItem
from schemas.inventory import InventoryItemCreate, InventoryItemUpdate
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

VALID_PRICING_MODES = ("piece", "size")
VALID_ITEM_TYPES = ("length", "window")


def _to_response(i: InventoryItem) -> dict:
    return {
        "id": i.id, "name": i.name, "category": i.category,
        "color": i.color, "size": i.size, "gaze": i.gaze,
        "unit": i.unit,
        "itemType": i.item_type,
        "pricingMode": i.pricing_mode,
        "currentStock": float(i.current_stock), "minStock": float(i.min_stock),
        "costPrice": float(i.cost_price), "salePrice": float(i.sale_price or 0), "supplier": i.supplier,
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
    if body.pricingMode and body.pricingMode not in VALID_PRICING_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid pricingMode: {body.pricingMode}. Allowed: {', '.join(VALID_PRICING_MODES)}")
    if body.itemType and body.itemType not in VALID_ITEM_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid itemType: {body.itemType}. Allowed: {', '.join(VALID_ITEM_TYPES)}")

    existing = await db.execute(
        select(InventoryItem).where(
            func.lower(InventoryItem.name) == body.name.strip().lower(),
            func.lower(InventoryItem.color) == (body.color or "").strip().lower(),
            func.lower(InventoryItem.size) == (body.size or "").strip().lower(),
            func.lower(InventoryItem.gaze) == (body.gaze or "").strip().lower(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Inventory item with this name, color, size, gaze already exists")

    item = InventoryItem(
        name=body.name, category=body.category, color=body.color, size=body.size, gaze=body.gaze,
        unit=body.unit, item_type=body.itemType, pricing_mode=body.pricingMode,
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

    if body.pricingMode and body.pricingMode not in VALID_PRICING_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid pricingMode: {body.pricingMode}. Allowed: {', '.join(VALID_PRICING_MODES)}")
    if body.itemType and body.itemType not in VALID_ITEM_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid itemType: {body.itemType}. Allowed: {', '.join(VALID_ITEM_TYPES)}")

    if body.name and body.name.strip().lower() != (item.name or "").strip().lower():
        existing = await db.execute(
            select(InventoryItem).where(
                func.lower(InventoryItem.name) == body.name.strip().lower(),
                func.lower(InventoryItem.color) == (body.color or "").strip().lower(),
                func.lower(InventoryItem.size) == (body.size or "").strip().lower(),
                func.lower(InventoryItem.gaze) == (body.gaze or "").strip().lower(),
                InventoryItem.id != item_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Inventory item with this name, color, size, gaze already exists")

    item.name = body.name
    item.category = body.category
    item.color = body.color
    item.size = body.size
    item.gaze = body.gaze
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
