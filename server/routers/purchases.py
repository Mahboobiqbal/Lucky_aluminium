import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.inventory import InventoryItem
from models.product import Product
from models.purchase import Purchase, PurchaseItem
from schemas.purchase import PurchaseCreate, PurchaseResponse
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


def _normalize_product_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _build_product_code(product_name: str, purchase_id: int, item_index: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", product_name.strip().lower()).strip("-") or "item"
    return f"{base[:10]}-{purchase_id}-{item_index + 1}".upper()


async def _sync_purchase_products(purchase: Purchase, items: list, db: AsyncSession) -> None:
    for index, item in enumerate(items):
        product_name = (getattr(item, "productName", "") or "").strip()
        if not product_name:
            continue

        normalized_name = _normalize_product_name(product_name)
        existing_result = await db.execute(select(Product).where(func.lower(Product.name) == normalized_name))
        product = existing_result.scalar_one_or_none()

        if product is None:
            product = Product(
                code=_build_product_code(product_name, purchase.id, index),
                name=product_name,
                category="Purchased",
                opening_type=None,
                profile_series=None,
                glass_type=None,
                glass_thickness=None,
                frame_color=None,
                handle_type=None,
                lock_type=None,
                unit="pcs",
                base_price=float(getattr(item, "purchasePrice", 0) or 0),
                description=f"Added from purchase {purchase.invoice_number} ({purchase.supplier_name})",
                active=True,
                created_at=datetime.utcnow(),
            )
            db.add(product)
            await db.flush()
        else:
            existing_name = (product.name or "").strip()
            if not existing_name:
                product.name = product_name
            product.category = product.category or "Purchased"
            product.unit = product.unit or "pcs"
            if float(getattr(item, "purchasePrice", 0) or 0) > 0:
                product.base_price = float(getattr(item, "purchasePrice", 0) or 0)
            if not product.description:
                product.description = f"Added from purchase {purchase.invoice_number} ({purchase.supplier_name})"
            elif purchase.invoice_number not in product.description:
                product.description = f"{product.description} | Purchase {purchase.invoice_number}".strip()
            product.active = True


async def _sync_purchase_inventory(purchase: Purchase, items: list, db: AsyncSession) -> None:
    for item in items:
        product_name = (getattr(item, "productName", "") or "").strip()
        if not product_name:
            continue

        normalized_name = _normalize_product_name(product_name)
        existing_result = await db.execute(select(InventoryItem).where(func.lower(InventoryItem.name) == normalized_name))
        inventory = existing_result.scalar_one_or_none()

        width_ft = float(getattr(item, "widthFt", 0) or 0)
        height_ft = float(getattr(item, "heightFt", 0) or 0)
        quantity = float(getattr(item, "quantity", 0) or 0)
        total_stock = width_ft * height_ft * quantity if width_ft and height_ft else quantity

        if inventory is None:
            inventory = InventoryItem(
                name=product_name,
                category="Purchased",
                unit="pcs",
                current_stock=total_stock,
                min_stock=0,
                cost_price=float(getattr(item, "purchasePrice", 0) or 0),
                supplier=purchase.supplier_name,
                width_ft=width_ft,
                height_ft=height_ft,
                stock_qty=quantity,
                created_at=datetime.utcnow(),
            )
            db.add(inventory)
        else:
            inventory.category = inventory.category or "Purchased"
            inventory.unit = inventory.unit or "pcs"
            inventory.supplier = inventory.supplier or purchase.supplier_name
            if float(getattr(item, "purchasePrice", 0) or 0) > 0:
                inventory.cost_price = float(getattr(item, "purchasePrice", 0) or 0)
            if width_ft > 0:
                inventory.width_ft = width_ft
            if height_ft > 0:
                inventory.height_ft = height_ft
            inventory.stock_qty = float(inventory.stock_qty or 0) + quantity
            inventory.current_stock = float(inventory.current_stock or 0) + total_stock


def _to_response(p: Purchase) -> dict:
    return {
        "id": p.id,
        "invoiceNumber": p.invoice_number,
        "supplierId": p.supplier_id,
        "supplierName": p.supplier_name,
        "paymentType": p.payment_type,
        "totalAmount": float(p.total_amount),
        "date": p.date,
        "notes": p.notes,
        "createdAt": p.created_at,
        "items": [
            {
                "id": i.id,
                "productName": i.product_name,
                "widthFt": float(i.width_ft or 0),
                "heightFt": float(i.height_ft or 0),
                "quantity": i.quantity,
                "purchasePrice": float(i.purchase_price),
                "salePrice": float(i.sale_price),
                "amount": float(i.amount),
            }
            for i in p.items
        ],
    }


@router.get("")
async def list_purchases(
    supplier_id: int | None = Query(default=None, alias="supplier_id"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission("purchase", "view")),
):
    query = select(Purchase).options(selectinload(Purchase.items)).order_by(Purchase.created_at.desc())
    if supplier_id is not None:
        query = query.where(Purchase.supplier_id == supplier_id)

    result = await db.execute(query)
    return [_to_response(p) for p in result.scalars().unique().all()]


@router.get("/{purchase_id}")
async def get_purchase(purchase_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("purchase", "view"))):
    result = await db.execute(
        select(Purchase).options(selectinload(Purchase.items)).where(Purchase.id == purchase_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return _to_response(p)


@router.post("")
async def create_purchase(body: PurchaseCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("purchase", "create"))):
    purchase = Purchase(
        invoice_number=body.invoiceNumber,
        supplier_id=body.supplierId,
        supplier_name=body.supplierName,
        payment_type=body.paymentType,
        total_amount=body.totalAmount,
        date=naive(body.date),
        notes=body.notes,
        created_at=datetime.utcnow(),
    )
    db.add(purchase)
    await db.flush()

    for item in body.items:
        db.add(PurchaseItem(
            purchase_id=purchase.id,
            product_name=item.productName,
            width_ft=item.widthFt,
            height_ft=item.heightFt,
            quantity=item.quantity,
            purchase_price=item.purchasePrice,
            sale_price=item.salePrice,
            amount=item.amount,
        ))

    await _sync_purchase_products(purchase, body.items, db)
    await _sync_purchase_inventory(purchase, body.items, db)
    await db.commit()
    result = await db.execute(
        select(Purchase).options(selectinload(Purchase.items)).where(Purchase.id == purchase.id)
    )
    return _to_response(result.scalar_one())


@router.delete("/{purchase_id}")
async def delete_purchase(purchase_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("purchase", "delete"))):
    result = await db.execute(select(Purchase).where(Purchase.id == purchase_id))
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    await db.delete(purchase)
    await db.commit()
    return {"message": "Purchase deleted", "success": True}
