from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.quotation import Quotation, QuotationItem
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
        "status": q.status,
        "notes": q.notes,
        "createdAt": q.created_at,
        "items": [
            {
                "id": i.id,
                "productId": i.product_id,
                "productName": i.product_name,
                "width": float(i.width),
                "height": float(i.height),
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
    quotation = Quotation(
        number=body.number,
        customer_id=body.customerId,
        customer_name=body.customerName,
        date=naive(body.date),
        subtotal=body.subtotal,
        discount=body.discount,
        extra_charges=body.extraCharges,
        total=body.total,
        status=body.status,
        notes=body.notes,
        created_at=datetime.utcnow(),
    )
    db.add(quotation)
    await db.flush()

    for item in body.items:
        db.add(QuotationItem(
            quotation_id=quotation.id,
            product_id=item.productId,
            product_name=item.productName,
            width=item.width,
            height=item.height,
            sqft=item.sqft,
            quantity=item.quantity,
            unit_price=item.unitPrice,
            amount=item.amount,
            notes=item.notes,
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
    quotation.subtotal = body.subtotal
    quotation.discount = body.discount
    quotation.extra_charges = body.extraCharges
    quotation.total = body.total
    quotation.status = body.status
    quotation.notes = body.notes

    old_items = await db.execute(select(QuotationItem).where(QuotationItem.quotation_id == quotation_id))
    for old in old_items.scalars().all():
        await db.delete(old)

    for item in body.items:
        db.add(QuotationItem(
            quotation_id=quotation.id,
            product_id=item.productId,
            product_name=item.productName,
            width=item.width,
            height=item.height,
            sqft=item.sqft,
            quantity=item.quantity,
            unit_price=item.unitPrice,
            amount=item.amount,
            notes=item.notes,
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

    await db.delete(quotation)
    await db.commit()
    return {"message": "Quotation deleted", "success": True}
