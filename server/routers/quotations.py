from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.quotation import Quotation, QuotationItem
from models.product import Product
from schemas.quotation import QuotationCreate, QuotationResponse, QuotationUpdate
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/quotations", tags=["quotations"])


def _to_response(q: Quotation) -> dict:
    return {
        "id": q.id,
        "number": q.number,
        "customerId": q.customer_id,
        "customerName": q.customer_name,
        "date": q.date,
        "subtotal": float(q.subtotal),
        "discount": float(q.discount),
        "extraCharges": float(q.extra_charges),
        "total": float(q.total),
        "previousBalance": float(q.previous_balance),
        "status": q.status,
        "notes": q.notes,
        "createdAt": q.created_at,
        "items": [
            {
                "id": i.id,
                "productId": i.product_id,
                "productName": i.product_name,
                "itemType": i.item_type,
                "width": float(i.width),
                "height": float(i.height),
                "length": float(i.length),
                "sqft": float(i.sqft) if i.sqft else None,
                "quantity": i.quantity,
                "unitPrice": float(i.unit_price),
                "amount": float(i.amount),
                "notes": i.notes,
            }
            for i in q.items
        ],
    }


@router.get("")
async def list_quotations(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("quotations", "view"))):
    result = await db.execute(
        select(Quotation).options(selectinload(Quotation.items)).order_by(Quotation.created_at.desc())
    )
    return [_to_response(q) for q in result.scalars().unique().all()]


@router.get("/{quotation_id}")
async def get_quotation(quotation_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("quotations", "view"))):
    result = await db.execute(
        select(Quotation).options(selectinload(Quotation.items)).where(Quotation.id == quotation_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _to_response(q)


@router.post("")
async def create_quotation(body: QuotationCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("quotations", "create"))):
    # Server-side financial calculation — never trust client amounts
    product_cache = {}
    for item in body.items:
        pname = item.productName
        if pname and pname not in product_cache:
            pres = await db.execute(select(Product).where(Product.id == item.productId) if item.productId else select(Product).where(Product.name == pname))
            product_cache[pname] = pres.scalar_one_or_none()

    calculated_items = []
    for item in body.items:
        product = product_cache.get(item.productName)
        server_price = float(product.base_price) if product else float(item.unitPrice)
        item_type = item.itemType or "other"
        qty = item.quantity
        w = float(item.width or 0)
        h = float(item.height or 0)
        l = float(item.length or 0)

        if item_type == "window" and l > 0:
            amount = l * qty * server_price
        elif w > 0 and h > 0:
            amount = w * h * qty * server_price
        else:
            amount = qty * server_price

        calculated_items.append({
            "productId": item.productId,
            "productName": item.productName,
            "itemType": item_type,
            "width": w,
            "height": h,
            "length": l,
            "sqft": item.sqft,
            "quantity": qty,
            "unitPrice": server_price,
            "amount": round(amount, 2),
            "notes": item.notes,
        })

    subtotal = round(sum(ci["amount"] for ci in calculated_items), 2)
    discount = max(0, float(body.discount or 0))
    extra = max(0, float(body.extraCharges or 0))
    total = round(subtotal - discount + extra, 2)

    quotation = Quotation(
        number=body.number,
        customer_id=body.customerId,
        customer_name=body.customerName,
        date=naive(body.date),
        subtotal=subtotal,
        discount=discount,
        extra_charges=extra,
        total=total,
        previous_balance=float(getattr(body, 'previousBalance', 0) or 0),
        status=body.status,
        notes=body.notes,
        created_at=datetime.utcnow(),
    )
    db.add(quotation)
    await db.flush()

    for ci in calculated_items:
        db.add(QuotationItem(
            quotation_id=quotation.id,
            product_id=ci["productId"],
            product_name=ci["productName"],
            item_type=ci["itemType"],
            width=ci["width"],
            height=ci["height"],
            length=ci["length"],
            sqft=ci["sqft"],
            quantity=ci["quantity"],
            unit_price=ci["unitPrice"],
            amount=ci["amount"],
            notes=ci["notes"],
        ))

    await db.commit()
    result = await db.execute(
        select(Quotation).options(selectinload(Quotation.items)).where(Quotation.id == quotation.id)
    )
    return _to_response(result.scalar_one())


@router.put("/{quotation_id}")
async def update_quotation(quotation_id: int, body: QuotationUpdate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("quotations", "edit"))):
    result = await db.execute(select(Quotation).where(Quotation.id == quotation_id))
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    quotation.number = body.number
    quotation.customer_id = body.customerId
    quotation.customer_name = body.customerName
    quotation.date = body.date
    quotation.status = body.status
    quotation.notes = body.notes

    old_items = await db.execute(select(QuotationItem).where(QuotationItem.quotation_id == quotation_id))
    for old in old_items.scalars().all():
        await db.delete(old)

    # Server-side financial calculation — never trust client amounts
    product_cache = {}
    for item in body.items:
        pname = item.productName
        if pname and pname not in product_cache:
            pres = await db.execute(select(Product).where(Product.id == item.productId) if item.productId else select(Product).where(Product.name == pname))
            product_cache[pname] = pres.scalar_one_or_none()

    calculated_items = []
    for item in body.items:
        product = product_cache.get(item.productName)
        server_price = float(product.base_price) if product else float(item.unitPrice)
        item_type = item.itemType or "other"
        qty = item.quantity
        w = float(item.width or 0)
        h = float(item.height or 0)
        l = float(item.length or 0)

        if item_type == "window" and l > 0:
            amount = l * qty * server_price
        elif w > 0 and h > 0:
            amount = w * h * qty * server_price
        else:
            amount = qty * server_price

        calculated_items.append({
            "productId": item.productId,
            "productName": item.productName,
            "itemType": item_type,
            "width": w,
            "height": h,
            "length": l,
            "sqft": item.sqft,
            "quantity": qty,
            "unitPrice": server_price,
            "amount": round(amount, 2),
            "notes": item.notes,
        })

    subtotal = round(sum(ci["amount"] for ci in calculated_items), 2)
    discount = max(0, float(body.discount or 0))
    extra = max(0, float(body.extraCharges or 0))
    total = round(subtotal - discount + extra, 2)

    quotation.subtotal = subtotal
    quotation.discount = discount
    quotation.extra_charges = extra
    quotation.total = total
    quotation.previous_balance = float(getattr(body, 'previousBalance', 0) or 0)

    for ci in calculated_items:
        db.add(QuotationItem(
            quotation_id=quotation.id,
            product_id=ci["productId"],
            product_name=ci["productName"],
            item_type=ci["itemType"],
            width=ci["width"],
            height=ci["height"],
            length=ci["length"],
            sqft=ci["sqft"],
            quantity=ci["quantity"],
            unit_price=ci["unitPrice"],
            amount=ci["amount"],
            notes=ci["notes"],
        ))

    await db.commit()
    result = await db.execute(
        select(Quotation).options(selectinload(Quotation.items)).where(Quotation.id == quotation_id)
    )
    return _to_response(result.scalar_one())


@router.delete("/{quotation_id}")
async def delete_quotation(quotation_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("quotations", "delete"))):
    result = await db.execute(select(Quotation).where(Quotation.id == quotation_id))
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    from models.order import Order
    orders = await db.execute(select(Order).where(Order.quotation_id == quotation_id).limit(1))
    if orders.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete quotation linked to existing orders. Remove orders first.")

    await db.delete(quotation)
    await db.commit()
    return {"message": "Quotation deleted", "success": True}
