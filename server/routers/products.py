from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
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
        "color": p.color,
        "size": p.size,
        "gaze": p.gaze,
        "unit": p.unit,
        "basePrice": float(p.base_price),
        "extraCharges": float(p.extra_charges),
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
    existing = await db.execute(select(Product).where(func.lower(Product.name) == body.name.strip().lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Product with this name already exists")

    product = Product(
        code=body.code, name=body.name, category=body.category,
        color=body.color, size=body.size, gaze=body.gaze,
        unit=body.unit, base_price=body.basePrice, extra_charges=body.extraCharges,
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

    if body.name and body.name.strip().lower() != (product.name or "").strip().lower():
        existing = await db.execute(select(Product).where(func.lower(Product.name) == body.name.strip().lower(), Product.id != product_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Product with this name already exists")

    product.code = body.code
    product.name = body.name
    product.category = body.category
    product.color = body.color
    product.size = body.size
    product.gaze = body.gaze
    product.unit = body.unit
    product.base_price = body.basePrice
    product.extra_charges = body.extraCharges
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
