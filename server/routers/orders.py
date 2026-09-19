from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.inventory import InventoryItem
from models.invoice import Invoice, InvoiceItem
from models.order import Order, OrderItem
from models.product import Product
from models.customer import Customer
from schemas.order import OrderCreate, OrderResponse, OrderUpdate
from utils.dates import naive
from utils.deps import require_permission
from database import get_db

VALID_ORDER_STATUSES = ("pending", "confirmed", "in_production", "ready", "delivered", "finished", "cancelled")

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _normalized_text(value: str | None) -> str:
    return (value or "").strip().lower()


def _product_variant_key(product_name: str, color: str | None = None, size: str | None = None, gaze: str | None = None, product_id: int | None = None):
    return (
        int(product_id) if product_id else None,
        _normalized_text(product_name),
        _normalized_text(color),
        _normalized_text(size),
        _normalized_text(gaze),
    )


def _inventory_query(product_name: str, color: str | None = None, size: str | None = None, gaze: str | None = None):
    q = select(InventoryItem).where(func.lower(func.coalesce(func.trim(InventoryItem.name), "")) == _normalized_text(product_name))
    if color is not None:
        q = q.where(func.lower(func.coalesce(func.trim(InventoryItem.color), "")) == _normalized_text(color))
    if size is not None:
        q = q.where(func.lower(func.coalesce(func.trim(InventoryItem.size), "")) == _normalized_text(size))
    if gaze is not None:
        q = q.where(func.lower(func.coalesce(func.trim(InventoryItem.gaze), "")) == _normalized_text(gaze))
    return q


def _product_query(product_name: str, color: str | None = None, size: str | None = None, gaze: str | None = None):
    q = select(Product).where(func.lower(func.coalesce(func.trim(Product.name), "")) == _normalized_text(product_name))
    if color is not None:
        q = q.where(func.lower(func.coalesce(func.trim(Product.color), "")) == _normalized_text(color))
    if size is not None:
        q = q.where(func.lower(func.coalesce(func.trim(Product.size), "")) == _normalized_text(size))
    if gaze is not None:
        q = q.where(func.lower(func.coalesce(func.trim(Product.gaze), "")) == _normalized_text(gaze))
    return q


async def _adjust_customer_previous_balance(db: AsyncSession, customer_id: int | None, delta: float):
    """Roll an order's previousBalance delta into the customer's running previous_balance."""
    if not customer_id or not delta:
        return
    result = await db.execute(select(Customer).where(Customer.id == customer_id).with_for_update())
    cust = result.scalar_one_or_none()
    if cust:
        cust.previous_balance = round(float(cust.previous_balance or 0) + delta, 2)


async def _adjust_stock(db: AsyncSession, product_name: str, delta: float, color: str = None, size: str = None, gaze: str = None):
    if not product_name:
        return
    result = await db.execute(_inventory_query(product_name, color, size, gaze).with_for_update())
    item = result.scalar_one_or_none()
    if not item:
        return
    item.current_stock = max(0, float(item.current_stock or 0) + float(delta))


async def _consumed_units(db: AsyncSession, product_name: str, item_type: str, width: float, height: float, length: float, quantity: float, color: str = None, size: str = None, gaze: str = None) -> float:
    """Stock units an order item consumes, based on the inventory item's pricing mode."""
    if not product_name:
        return 0
    result = await db.execute(_inventory_query(product_name, color, size, gaze))
    inv_item = result.scalars().first()
    if inv_item and inv_item.pricing_mode == "size":
        item_type = item_type or inv_item.item_type or "window"
        if item_type == "length":
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
        color = getattr(item, "color", None)
        size = getattr(item, "size", None)
        gaze = getattr(item, "gaze", None)
        result = await db.execute(_inventory_query(product_name, color, size, gaze).with_for_update())
        inv_item = result.scalars().first()
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
            color, size, gaze,
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
        "hardwareCharges": float(o.hardware_charges),
        "extraCharges": float(o.extra_charges),
        "total": float(o.total),
        "paid": float(o.paid),
        "previousBalance": float(o.previous_balance),
        "balance": float(o.balance),
        "grandTotal": float(o.grand_total),
        "status": o.status,
        "notes": o.notes,
        "createdAt": o.created_at,
        "items": [
            {
                "id": i.id,
                "productId": i.product_id,
                "productName": i.product_name,
                "color": i.color,
                "size": i.size,
                "gaze": i.gaze,
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
    try:
        if not body.items:
            raise HTTPException(status_code=400, detail="Order must have at least one item")

        if body.customerId:
            cust_result = await db.execute(select(Customer).where(Customer.id == body.customerId))
            if not cust_result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Customer not found")

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

        # Server-side financial calculation — never trust client amounts
        product_cache = {}
        for item in body.items:
            cache_key = _product_variant_key(item.productName, getattr(item, "color", None), getattr(item, "size", None), getattr(item, "gaze", None), item.productId)
            if cache_key not in product_cache:
                if item.productId:
                    pres = await db.execute(select(Product).where(Product.id == item.productId))
                else:
                    pres = await db.execute(_product_query(item.productName, getattr(item, "color", None), getattr(item, "size", None), getattr(item, "gaze", None)))
                product_cache[cache_key] = pres.scalars().first()

        calculated_items = []
        for item in body.items:
            cache_key = _product_variant_key(item.productName, getattr(item, "color", None), getattr(item, "size", None), getattr(item, "gaze", None), item.productId)
            product = product_cache.get(cache_key)
            server_price = float(product.base_price) if product else float(item.unitPrice)
            item_type = item.itemType or "window"
            qty = item.quantity
            w = float(item.width or 0)
            h = float(item.height or 0)
            l = float(item.length or 0)

            inv_result = await db.execute(_inventory_query(item.productName, getattr(item, "color", None), getattr(item, "size", None), getattr(item, "gaze", None)))
            inv_item = inv_result.scalars().first()
            pricing_mode = inv_item.pricing_mode if inv_item else "piece"
            inv_sale_price = float(inv_item.sale_price) if inv_item and float(getattr(inv_item, "sale_price", 0) or 0) > 0 else 0
            server_price = inv_sale_price if inv_sale_price > 0 else server_price
            color_value = getattr(item, "color", None) or (inv_item.color if inv_item else None)
            size_value = getattr(item, "size", None) or (inv_item.size if inv_item else None)
            gaze_value = getattr(item, "gaze", None) or (inv_item.gaze if inv_item else None)

            if pricing_mode == "size":
                if item_type == "length" and l > 0:
                    amount = l * qty * server_price
                elif w > 0 and h > 0:
                    amount = w * h * qty * server_price
                else:
                    amount = qty * server_price
            else:
                amount = qty * server_price

            calculated_items.append({
                "productId": product.id if product else item.productId,
                "productName": item.productName,
                "color": color_value,
                "size": size_value,
                "gaze": gaze_value,
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
        discount_pct = max(0, min(float(body.discountPercent or 0), 100))
        hardware = max(0, float(getattr(body, 'hardwareCharges', 0) or 0))
        extra = max(0, float(getattr(body, 'extraCharges', 0) or 0))
        discount_amount = round(subtotal * discount_pct / 100, 2)
        total = round(subtotal - discount_amount + hardware + extra, 2)

        if body.status and body.status not in VALID_ORDER_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}. Allowed: {', '.join(VALID_ORDER_STATUSES)}")
        paid_val = float(body.paid or 0)
        prev_bal = float(getattr(body, 'previousBalance', 0) or 0)
        balance_val = round(max(0, total + prev_bal - paid_val), 2)
        grand_total_val = round(total + prev_bal, 2)

        order = Order(
            number=body.number,
            customer_id=body.customerId,
            customer_name=body.customerName,
            quotation_id=body.quotationId,
            order_date=naive(body.orderDate),
            delivery_date=naive(body.deliveryDate),
            subtotal=subtotal,
            discount_percent=discount_pct,
            hardware_charges=hardware,
            extra_charges=extra,
            total=total,
            paid=paid_val,
            previous_balance=prev_bal,
            balance=balance_val,
            grand_total=grand_total_val,
            status=body.status,
            notes=body.notes,
            created_at=datetime.utcnow(),
        )
        db.add(order)
        await db.flush()

        # Roll the order's previous_balance into the customer's running previous_balance
        await _adjust_customer_previous_balance(db, order.customer_id, float(getattr(body, 'previousBalance', 0) or 0))

        order_items = []
        for ci in calculated_items:
            oi = OrderItem(
                order_id=order.id,
                product_id=ci["productId"],
                product_name=ci["productName"],
                color=ci.get("color"),
                size=ci.get("size"),
                gaze=ci.get("gaze"),
                item_type=ci["itemType"],
                width=ci["width"],
                height=ci["height"],
                length=ci["length"],
                sqft=ci["sqft"],
                quantity=ci["quantity"],
                unit_price=ci["unitPrice"],
                amount=ci["amount"],
                notes=ci["notes"],
            )
            db.add(oi)
            order_items.append(oi)

        await _sync_invoice(db, order, order_items)
        for item in order_items:
            consumed = await _consumed_units(db, item.product_name, item.item_type, item.width, item.height, item.length, item.quantity, item.color, item.size, item.gaze)
            await _adjust_stock(db, item.product_name, -consumed, item.color, item.size, item.gaze)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

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

    old_previous = float(order.previous_balance or 0)

    if body.status and body.status not in VALID_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}. Allowed: {', '.join(VALID_ORDER_STATUSES)}")

    if body.customerId:
        cust_result = await db.execute(select(Customer).where(Customer.id == body.customerId))
        if not cust_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Customer not found")

    try:
        # Get old items to calculate net stock change
        old_items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
        old_items = old_items_result.scalars().all()
        
        # Pre-resolve null color/size/gaze for each new item from old items
        resolved_csg = []
        for item in body.items:
            c = getattr(item, "color", None)
            s = getattr(item, "size", None)
            g = getattr(item, "gaze", None)
            if c is None and s is None and g is None:
                pid = item.productId
                pname = item.productName if hasattr(item, 'productName') else item.product_name
                candidates = []
                for oi in old_items:
                    if pid and oi.product_id == pid:
                        candidates.append(oi)
                    elif not pid and _normalized_text(oi.product_name) == _normalized_text(pname):
                        candidates.append(oi)
                matched = None
                if len(candidates) == 1:
                    matched = candidates[0]
                elif len(candidates) > 1:
                    best_score = -1
                    matched = candidates[0]
                    nw, nh, nl = float(getattr(item, "width", 0) or 0), float(getattr(item, "height", 0) or 0), float(getattr(item, "length", 0) or 0)
                    nq = item.quantity
                    for cm in candidates:
                        score = (1 if abs(float(cm.width or 0) - nw) < 0.001 else 0) + (1 if abs(float(cm.height or 0) - nh) < 0.001 else 0) + (1 if abs(float(cm.length or 0) - nl) < 0.001 else 0) + (1 if cm.quantity == nq else 0)
                        if score > best_score:
                            best_score = score
                            matched = cm
                if matched:
                    c, s, g = matched.color, matched.size, matched.gaze
            resolved_csg.append((c, s, g))
        
        # Calculate net stock change per product (keyed by name+color+size+gaze)
        stock_changes = {}
        for old in old_items:
            old_consumed = float(await _consumed_units(db, old.product_name, old.item_type, old.width, old.height, old.length, old.quantity, old.color, old.size, old.gaze))
            key = (_normalized_text(old.product_name), _normalized_text(old.color), _normalized_text(old.size), _normalized_text(old.gaze))
            stock_changes[key] = float(stock_changes.get(key, 0)) + float(old_consumed)
        for idx, item in enumerate(body.items):
            product_name = item.productName if hasattr(item, 'productName') else item.product_name
            color, size, gaze = resolved_csg[idx]
            new_consumed = float(await _consumed_units(db, product_name, getattr(item, "itemType", None), float(getattr(item, "width", 0) or 0), float(getattr(item, "height", 0) or 0), float(getattr(item, "length", 0) or 0), item.quantity, color, size, gaze))
            key = (_normalized_text(product_name), _normalized_text(color), _normalized_text(size), _normalized_text(gaze))
            stock_changes[key] = float(stock_changes.get(key, 0)) - float(new_consumed)
        
        
        # Check if stock is sufficient for the net changes
        errors = []
        for (pn, cl, sz, gz), delta in stock_changes.items():
            if delta < 0:  # Only check if we're deducting more than returning
                inv_q = select(InventoryItem).where(func.lower(func.coalesce(func.trim(InventoryItem.name), "")) == pn)
                if cl:
                    inv_q = inv_q.where(func.lower(func.coalesce(func.trim(InventoryItem.color), "")) == cl)
                if sz:
                    inv_q = inv_q.where(func.lower(func.coalesce(func.trim(InventoryItem.size), "")) == sz)
                if gz:
                    inv_q = inv_q.where(func.lower(func.coalesce(func.trim(InventoryItem.gaze), "")) == gz)
                result = await db.execute(inv_q.with_for_update())
                inv_item = result.scalars().first()
                if inv_item:
                    available = float(inv_item.current_stock or 0)
                    needed = abs(delta)
                    if needed > available:
                        errors.append({
                            "product": pn,
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
            old_consumed = await _consumed_units(db, old.product_name, old.item_type, old.width, old.height, old.length, old.quantity, old.color, old.size, old.gaze)
            await _adjust_stock(db, old.product_name, old_consumed, old.color, old.size, old.gaze)
            await db.delete(old)
        
        # Server-side financial calculation — never trust client amounts
        product_cache = {}
        for item in body.items:
            cache_key = _product_variant_key(item.productName, getattr(item, "color", None), getattr(item, "size", None), getattr(item, "gaze", None), item.productId)
            if cache_key not in product_cache:
                if item.productId:
                    pres = await db.execute(select(Product).where(Product.id == item.productId))
                else:
                    pres = await db.execute(_product_query(item.productName, getattr(item, "color", None), getattr(item, "size", None), getattr(item, "gaze", None)))
                product_cache[cache_key] = pres.scalars().first()

        calculated_items = []
        for idx, item in enumerate(body.items):
            cache_key = _product_variant_key(item.productName, getattr(item, "color", None), getattr(item, "size", None), getattr(item, "gaze", None), item.productId)
            product = product_cache.get(cache_key)
            server_price = float(product.base_price) if product else float(item.unitPrice)
            item_type = item.itemType or "window"
            qty = item.quantity
            w = float(item.width or 0)
            h = float(item.height or 0)
            l = float(item.length or 0)

            rc, rs, rg = resolved_csg[idx]
            inv_result = await db.execute(_inventory_query(item.productName, rc, rs, rg))
            inv_item = inv_result.scalars().first()
            pricing_mode = inv_item.pricing_mode if inv_item else "piece"
            inv_sale_price = float(inv_item.sale_price) if inv_item and float(getattr(inv_item, "sale_price", 0) or 0) > 0 else 0
            server_price = inv_sale_price if inv_sale_price > 0 else server_price
            color_value = getattr(item, "color", None) or rc
            size_value = getattr(item, "size", None) or rs
            gaze_value = getattr(item, "gaze", None) or rg

            if pricing_mode == "size":
                if item_type == "length" and l > 0:
                    amount = l * qty * server_price
                elif w > 0 and h > 0:
                    amount = w * h * qty * server_price
                else:
                    amount = qty * server_price
            else:
                amount = qty * server_price

            calculated_items.append({
                "productId": product.id if product else item.productId,
                "productName": item.productName,
                "color": color_value,
                "size": size_value,
                "gaze": gaze_value,
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
        discount_pct = max(0, min(float(body.discountPercent or 0), 100))
        hardware = max(0, float(getattr(body, 'hardwareCharges', 0) or 0))
        extra = max(0, float(getattr(body, 'extraCharges', 0) or 0))
        discount_amount = round(subtotal * discount_pct / 100, 2)
        total = round(subtotal - discount_amount + hardware + extra, 2)

        order.number = body.number
        order.customer_id = body.customerId
        order.customer_name = body.customerName
        order.quotation_id = body.quotationId
        order.order_date = naive(body.orderDate)
        order.delivery_date = naive(body.deliveryDate)
        order.subtotal = subtotal
        order.discount_percent = discount_pct
        order.hardware_charges = hardware
        order.extra_charges = extra
        order.total = total
        new_paid = float(body.paid or 0)
        order.paid = new_paid
        new_previous = float(getattr(body, 'previousBalance', 0) or 0)
        order.previous_balance = new_previous
        order.balance = round(max(0, total + new_previous - new_paid), 2)
        order.grand_total = round(total + new_previous, 2)
        order.status = body.status
        order.notes = body.notes

        # Roll the delta into the customer's running previous_balance (handle customer change too)
        if order.customer_id:
            if body.customerId and body.customerId != order.customer_id:
                await _adjust_customer_previous_balance(db, order.customer_id, -old_previous)
                await _adjust_customer_previous_balance(db, body.customerId, new_previous)
            else:
                await _adjust_customer_previous_balance(db, order.customer_id, new_previous - old_previous)

        order_items = []
        for ci in calculated_items:
            oi = OrderItem(
                order_id=order.id,
                product_id=ci["productId"],
                product_name=ci["productName"],
                color=ci.get("color"),
                size=ci.get("size"),
                gaze=ci.get("gaze"),
                item_type=ci["itemType"],
                width=ci["width"],
                height=ci["height"],
                length=ci["length"],
                sqft=ci["sqft"],
                quantity=ci["quantity"],
                unit_price=ci["unitPrice"],
                amount=ci["amount"],
                notes=ci["notes"],
            )
            db.add(oi)
            order_items.append(oi)

        await _sync_invoice(db, order, order_items)
        for item in order_items:
            consumed = await _consumed_units(db, item.product_name, item.item_type, item.width, item.height, item.length, item.quantity, item.color, item.size, item.gaze)
            await _adjust_stock(db, item.product_name, -consumed, item.color, item.size, item.gaze)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

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

    if status not in VALID_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}. Allowed: {', '.join(VALID_ORDER_STATUSES)}")

    try:
        if status == "cancelled":
            items = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
            for item in items.scalars().all():
                consumed = await _consumed_units(db, item.product_name, item.item_type, item.width, item.height, item.length, item.quantity, item.color, item.size, item.gaze)
                await _adjust_stock(db, item.product_name, consumed, item.color, item.size, item.gaze)

        order.status = status
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {"message": "Status updated", "success": True}


@router.delete("/{order_id}")
async def delete_order(order_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("orders", "delete"))):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        inv_result = await db.execute(select(Invoice).where(Invoice.order_id == order_id))
        inv = inv_result.scalar_one_or_none()
        if inv:
            await db.delete(inv)

        items = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
        for item in items.scalars().all():
            consumed = await _consumed_units(db, item.product_name, item.item_type, item.width, item.height, item.length, item.quantity, item.color, item.size, item.gaze)
            await _adjust_stock(db, item.product_name, consumed, item.color, item.size, item.gaze)

        # Reverse any previous_balance that was rolled into the customer
        await _adjust_customer_previous_balance(db, order.customer_id, -float(order.previous_balance or 0))

        await db.delete(order)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {"message": "Order deleted", "success": True}
