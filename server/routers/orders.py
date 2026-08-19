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
    item.current_stock = max(0, float(item.current_stock or 0) + delta)


async def _consumed_units(db: AsyncSession, product_name: str, item_type: str, width: float, height: float, length: float, quantity: float) -> float:
    """Stock units an order item consumes, based on the inventory item's pricing mode."""
    if not product_name:
        return 0
    result = await db.execute(select(InventoryItem).where(InventoryItem.name == product_name))
    inv_item = result.scalar_one_or_none()
    if inv_item and inv_item.pricing_mode == "size":
        item_type = item_type or inv_item.item_type or "other"
        if item_type == "window":
            dim = length or inv_item.length or 0
            return dim * quantity if dim else quantity
        else:
            w = width or inv_item.width_ft or 0
            h = height or inv_item.height_ft or 0
            return w * h * quantity if (w and h) else quantity
    return quantity


async def _check_stock(db: AsyncSession, items: list) -> list:
    """Check if enough stock is available for each item. Returns list of errors."""
    errors = []
    for item in items:
        product_name = item.productName if hasattr(item, 'productName') else item.product_name
        if not product_name:
            continue
        result = await db.execute(select(InventoryItem).where(InventoryItem.name == product_name))
        inv_item = result.scalar_one_or_none()
        if not inv_item:
            continue
        available = float(inv_item.current_stock or 0)
        requested = await _consumed_units(
            db, product_name,
            getattr(item, "itemType", None),
            float(getattr(item, "width", 0) or 0),
            float(getattr(item, "height", 0) or 0),
            float(getattr(item, "length", 0) or 0),
            item.quantity,
        )
        if requested > available:
            errors.append({
                "product": product_name,
                "requested": requested,
                "available": available,
                "shortage": requested - available,
            })
    return errors


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
    # Check stock availability before creating order
    stock_errors = await _check_stock(db, body.items)
    if stock_errors:
        error_messages = []
        for err in stock_errors:
            error_messages.append(f"{err['product']}: requested {err['requested']}, available {err['available']} (short by {err['shortage']})")
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for: {'; '.join(error_messages)}"
        )

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
        consumed = await _consumed_units(db, item.product_name, item.item_type, item.width, item.height, item.length, item.quantity)
        await _adjust_stock(db, item.product_name, -consumed)
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

    # Get old items to calculate net stock change
    old_items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    old_items = old_items_result.scalars().all()
    
    # Calculate net stock change per product
    stock_changes = {}
    for old in old_items:
        old_consumed = await _consumed_units(db, old.product_name, old.item_type, old.width, old.height, old.length, old.quantity)
        stock_changes[old.product_name] = stock_changes.get(old.product_name, 0) + old_consumed
    for item in body.items:
        product_name = item.productName if hasattr(item, 'productName') else item.product_name
        new_consumed = await _consumed_units(db, product_name, getattr(item, "itemType", None), float(getattr(item, "width", 0) or 0), float(getattr(item, "height", 0) or 0), float(getattr(item, "length", 0) or 0), item.quantity)
        stock_changes[product_name] = stock_changes.get(product_name, 0) - new_consumed
    
    # Check if stock is sufficient for the net changes
    errors = []
    for product_name, delta in stock_changes.items():
        if delta < 0:  # Only check if we're deducting more than returning
            result = await db.execute(select(InventoryItem).where(InventoryItem.name == product_name))
            inv_item = result.scalar_one_or_none()
            if inv_item:
                available = float(inv_item.current_stock or 0)
                needed = abs(delta)
                if needed > available:
                    errors.append({
                        "product": product_name,
                        "requested": needed,
                        "available": available,
                        "shortage": needed - available,
                    })
    
    if errors:
        error_messages = []
        for err in errors:
            error_messages.append(f"{err['product']}: requested {err['requested']}, available {err['available']} (short by {err['shortage']})")
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for: {'; '.join(error_messages)}"
        )

    # Delete old items and restore stock
    for old in old_items:
        old_consumed = await _consumed_units(db, old.product_name, old.item_type, old.width, old.height, old.length, old.quantity)
        await _adjust_stock(db, old.product_name, old_consumed)
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
        consumed = await _consumed_units(db, item.product_name, item.item_type, item.width, item.height, item.length, item.quantity)
        await _adjust_stock(db, item.product_name, -consumed)
    await db.commit()

    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
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
            consumed = await _consumed_units(db, item.product_name, item.item_type, item.width, item.height, item.length, item.quantity)
            await _adjust_stock(db, item.product_name, consumed)

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
        consumed = await _consumed_units(db, item.product_name, item.item_type, item.width, item.height, item.length, item.quantity)
        await _adjust_stock(db, item.product_name, consumed)

    await db.delete(order)
    await db.commit()
    return {"message": "Order deleted", "success": True}
