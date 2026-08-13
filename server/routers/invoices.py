from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.invoice import Invoice
from utils.deps import require_permission

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


def _to_response(inv: Invoice) -> dict:
    return {
        "id": inv.id,
        "number": inv.number,
        "orderId": inv.order_id,
        "customerId": inv.customer_id,
        "customerName": inv.customer_name,
        "date": inv.date,
        "subtotal": float(inv.subtotal),
        "discount": float(inv.discount),
        "extraCharges": float(inv.extra_charges),
        "total": float(inv.total),
        "paid": float(inv.paid),
        "createdAt": inv.created_at,
        "items": [
            {
                "id": i.id,
                "productName": i.product_name,
                "itemType": i.item_type,
                "width": float(i.width),
                "height": float(i.height),
                "length": float(i.length),
                "quantity": i.quantity,
                "unitPrice": float(i.unit_price),
                "amount": float(i.amount),
                "notes": i.notes,
            }
            for i in inv.items
        ],
    }


@router.get("")
async def list_invoices(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("invoices", "view"))):
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.items)).order_by(Invoice.created_at.desc())
    )
    return [_to_response(inv) for inv in result.scalars().unique().all()]


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("invoices", "view"))):
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.items)).where(Invoice.id == invoice_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _to_response(inv)


@router.delete("/by-order/{order_id}")
async def delete_invoice_by_order(order_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("invoices", "delete"))):
    result = await db.execute(select(Invoice).where(Invoice.order_id == order_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    await db.delete(inv)
    await db.commit()
    return {"message": "Invoice deleted", "success": True}


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("invoices", "delete"))):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    await db.delete(inv)
    await db.commit()
    return {"message": "Invoice deleted", "success": True}
