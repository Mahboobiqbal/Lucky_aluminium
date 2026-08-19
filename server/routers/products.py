from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.product import Product
from schemas.product import ProductCreate, ProductUpdate
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/products", tags=["products"])


def _to_response(p: Product) -> dict:
    return {
        "id": p.id,
        "code": p.code,
        "name": p.name,
        "category": p.category,
        "openingType": p.opening_type,
        "profileSeries": p.profile_series,
        "glassType": p.glass_type,
        "glassThickness": p.glass_thickness,
        "frameColor": p.frame_color,
        "handleType": p.handle_type,
        "lockType": p.lock_type,
        "unit": p.unit,
        "basePrice": float(p.base_price),
        "description": p.description,
        "active": p.active,
        "createdAt": p.created_at,
    }


@router.get("")
async def list_products(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("products", "view"))):
    result = await db.execute(select(Product).order_by(Product.created_at.desc()))
    return [_to_response(p) for p in result.scalars().all()]


@router.get("/{product_id}")
async def get_product(product_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("products", "view"))):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _to_response(product)


@router.post("")
async def create_product(body: ProductCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("products", "create"))):
    product = Product(
        code=body.code, name=body.name, category=body.category,
        opening_type=body.openingType, profile_series=body.profileSeries,
        glass_type=body.glassType, glass_thickness=body.glassThickness,
        frame_color=body.frameColor, handle_type=body.handleType,
        lock_type=body.lockType, unit=body.unit, base_price=body.basePrice,
        description=body.description, active=body.active,
        created_at=datetime.utcnow(),
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return _to_response(product)


@router.put("/{product_id}")
async def update_product(product_id: int, body: ProductUpdate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("products", "edit"))):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.code = body.code
    product.name = body.name
    product.category = body.category
    product.opening_type = body.openingType
    product.profile_series = body.profileSeries
    product.glass_type = body.glassType
    product.glass_thickness = body.glassThickness
    product.frame_color = body.frameColor
    product.handle_type = body.handleType
    product.lock_type = body.lockType
    product.unit = body.unit
    product.base_price = body.basePrice
    product.description = body.description
    product.active = body.active

    await db.commit()
    await db.refresh(product)
    return _to_response(product)


@router.delete("/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("products", "delete"))):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from models.order import OrderItem
    from models.quotation import QuotationItem

    order_items = await db.execute(select(OrderItem).where(OrderItem.product_id == product_id).limit(1))
    if order_items.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete product used in orders. Deactivate it instead.")

    quotation_items = await db.execute(select(QuotationItem).where(QuotationItem.product_id == product_id).limit(1))
    if quotation_items.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete product used in quotations. Deactivate it instead.")

    await db.delete(product)
    await db.commit()
    return {"message": "Product deleted", "success": True}
