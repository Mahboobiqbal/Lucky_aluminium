from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.inventory import InventoryItem
from models.invoice import Invoice, InvoiceItem
from models.order import Order, OrderItem
from schemas.order import OrderCreate, OrderResponse, OrderUpdate
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _adjust_stock(db: AsyncSession, product_name: str, delta: float):
    if not product_name:
        return
    result = await db.execute(select(InventoryItem).where(InventoryItem.name == product_name))
    item = result.scalar_one_or_none()
    if not item:
        return
    item.current_stock = max(0, (item.current_stock or 0) + delta)


def _to_response(o: Order) -> dict:
    return {
        "id": o.id,
        "number": o.number,
        "customerId": o.customer_id,
        "customerName": o.customer_name,
        "quotationId": o.quotation_id,
        "orderDate": o.order_date,
        "deliveryDate": o.delivery_date,
        "subtotal": float(o.subtotal),
        "discountPercent": float(o.discount_percent),
        "total": float(o.total),
        "paid": float(o.paid),
        "status": o.status,
        "notes": o.notes,
        "createdAt": o.created_at,
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
            for i in o.items
        ],
    }


async def _sync_invoice(db: AsyncSession, order: Order, items: list):
    result = await db.execute(select(Invoice).where(Invoice.order_id == order.id))
    invoice = result.scalar_one_or_none()

    invoice_data = {
        "number": f"INV-{str(order.id).zfill(4)}",
        "customer_id": order.customer_id,
        "customer_name": order.customer_name,
        "date": naive(order.order_date),
        "subtotal": order.subtotal,
        "total": order.total,
        "paid": order.paid,
    }

    if invoice:
        for k, v in invoice_data.items():
            setattr(invoice, k, v)
        old_items = await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))
        for old in old_items.scalars().all():
            await db.delete(old)
    else:
        invoice = Invoice(order_id=order.id, **invoice_data)
        db.add(invoice)
        await db.flush()

    for item in items:
        db.add(InvoiceItem(
            invoice_id=invoice.id,
            product_name=item.product_name,
            item_type=item.item_type,
            width=item.width,
            height=item.height,
            length=item.length,
            quantity=item.quantity,
            unit_price=item.unit_price,
            amount=item.amount,
            notes=item.notes,
        ))


@router.get("")
async def list_orders(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("orders", "view"))):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    )
    return [_to_response(o) for o in result.scalars().unique().all()]


@router.get("/{order_id}")
async def get_order(order_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("orders", "view"))):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _to_response(order)


@router.post("")
async def create_order(body: OrderCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("orders", "create"))):
    order = Order(
        number=body.number,
        customer_id=body.customerId,
        customer_name=body.customerName,
        quotation_id=body.quotationId,
        order_date=naive(body.orderDate),
        delivery_date=naive(body.deliveryDate),
        subtotal=body.subtotal,
        discount_percent=body.discountPercent,
        total=body.total,
        paid=body.paid,
        status=body.status,
        notes=body.notes,
        created_at=datetime.utcnow(),
    )
    db.add(order)
    await db.flush()

    order_items = []
    for item in body.items:
        oi = OrderItem(
            order_id=order.id,
            product_id=item.productId,
            product_name=item.productName,
            item_type=item.itemType,
            width=item.width,
            height=item.height,
            length=item.length,
            sqft=item.sqft,
            quantity=item.quantity,
            unit_price=item.unitPrice,
            amount=item.amount,
            notes=item.notes,
        )
        db.add(oi)
        order_items.append(oi)

    await _sync_invoice(db, order, order_items)
    for item in order_items:
        await _adjust_stock(db, item.product_name, -item.quantity)
    await db.commit()

    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
    )
    return _to_response(result.scalar_one())


@router.put("/{order_id}")
async def update_order(order_id: int, body: OrderUpdate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("orders", "edit"))):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_items = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    for old in old_items.scalars().all():
        await _adjust_stock(db, old.product_name, old.quantity)
        await db.delete(old)
    order.number = body.number
    order.customer_id = body.customerId
    order.customer_name = body.customerName
    order.quotation_id = body.quotationId
    order.order_date = naive(body.orderDate)
    order.delivery_date = naive(body.deliveryDate)
    order.subtotal = body.subtotal
    order.discount_percent = body.discountPercent
    order.total = body.total
    order.paid = body.paid
    order.status = body.status
    order.notes = body.notes

    order_items = []
    for item in body.items:
        oi = OrderItem(
            order_id=order.id,
            product_id=item.productId,
            product_name=item.productName,
            item_type=item.itemType,
            width=item.width,
            height=item.height,
            length=item.length,
            sqft=item.sqft,
            quantity=item.quantity,
            unit_price=item.unitPrice,
            amount=item.amount,
            notes=item.notes,
        )
        db.add(oi)
        order_items.append(oi)

    await _sync_invoice(db, order, order_items)
    for item in order_items:
        await _adjust_stock(db, item.product_name, -item.quantity)
    await db.commit()

    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    return _to_response(result.scalar_one())


@router.put("/{order_id}/status")
async def update_order_status(order_id: int, status: str, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("orders", "edit"))):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if status == "cancelled":
        items = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
        for item in items.scalars().all():
            await _adjust_stock(db, item.product_name, item.quantity)

    order.status = status
    await db.commit()
    return {"message": "Status updated", "success": True}


@router.delete("/{order_id}")
async def delete_order(order_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("orders", "delete"))):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    inv_result = await db.execute(select(Invoice).where(Invoice.order_id == order_id))
    inv = inv_result.scalar_one_or_none()
    if inv:
        await db.delete(inv)

    items = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    for item in items.scalars().all():
        await _adjust_stock(db, item.product_name, item.quantity)

    await db.delete(order)
    await db.commit()
    return {"message": "Order deleted", "success": True}
