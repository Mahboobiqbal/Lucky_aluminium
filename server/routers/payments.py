from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.order import Order
from models.payment import Payment
from schemas.payment import PaymentCreate, PaymentResponse
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _to_response(p: Payment) -> dict:
    return {
        "id": p.id,
        "invoiceId": p.invoice_id,
        "orderId": p.order_id,
        "customerId": p.customer_id,
        "customerName": p.customer_name,
        "supplierId": p.supplier_id,
        "supplierName": p.supplier_name,
        "amount": float(p.amount),
        "method": p.method,
        "date": p.date,
        "notes": p.notes,
        "createdAt": p.created_at,
    }


@router.get("")
async def list_payments(
    supplier_id: int | None = Query(default=None, alias="supplier_id"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("payments", "view")),
):
    query = select(Payment).order_by(Payment.created_at.desc())
    if supplier_id is not None:
        query = query.where(Payment.supplier_id == supplier_id)

    result = await db.execute(query)
    return [_to_response(p) for p in result.scalars().all()]


@router.get("/{payment_id}")
async def get_payment(payment_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("payments", "view"))):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    return _to_response(p)


@router.post("")
async def create_payment(body: PaymentCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("payments", "create"))):
    payment = Payment(
        invoice_id=body.invoiceId,
        order_id=body.orderId,
        customer_id=body.customerId,
        customer_name=body.customerName,
        supplier_id=body.supplierId,
        supplier_name=body.supplierName,
        amount=body.amount,
        method=body.method,
        date=naive(body.date),
        notes=body.notes,
        created_at=datetime.utcnow(),
    )
    db.add(payment)

    if body.orderId:
        result = await db.execute(select(Order).where(Order.id == body.orderId))
        order = result.scalar_one_or_none()
        if order:
            order.paid = float(order.paid) + body.amount

    await db.commit()
    await db.refresh(payment)
    return _to_response(payment)


@router.put("/{payment_id}")
async def update_payment(payment_id: int, body: PaymentCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("payments", "edit"))):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment.invoice_id = body.invoiceId
    payment.order_id = body.orderId
    payment.customer_id = body.customerId
    payment.customer_name = body.customerName
    payment.supplier_id = body.supplierId
    payment.supplier_name = body.supplierName
    payment.amount = body.amount
    payment.method = body.method
    payment.date = naive(body.date)
    payment.notes = body.notes

    await db.commit()
    await db.refresh(payment)
    return _to_response(payment)


@router.delete("/{payment_id}")
async def delete_payment(payment_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("payments", "delete"))):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.order_id:
        order_result = await db.execute(select(Order).where(Order.id == payment.order_id))
        order = order_result.scalar_one_or_none()
        if order:
            order.paid = max(0, float(order.paid) - float(payment.amount))

    await db.delete(payment)
    await db.commit()
    return {"message": "Payment deleted", "success": True}
