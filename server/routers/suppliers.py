from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.supplier import Supplier
from schemas.supplier import SupplierCreate, SupplierUpdate
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


def _to_response(s: Supplier) -> dict:
    return {
        "id": s.id, "name": s.name, "company": s.company, "contact": s.contact,
        "mobile": s.mobile, "city": s.city, "email": s.email, "address": s.address,
        "products": s.products, "notes": s.notes, "createdAt": s.created_at,
    }


@router.get("")
async def list_suppliers(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("suppliers", "view"))):
    result = await db.execute(select(Supplier).order_by(Supplier.created_at.desc()))
    return [_to_response(s) for s in result.scalars().all()]


@router.get("/{supplier_id}")
async def get_supplier(supplier_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("suppliers", "view"))):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return _to_response(supplier)


@router.post("")
async def create_supplier(body: SupplierCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("suppliers", "create"))):
    supplier = Supplier(**body.model_dump(), created_at=datetime.utcnow())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return _to_response(supplier)


@router.put("/{supplier_id}")
async def update_supplier(supplier_id: int, body: SupplierUpdate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("suppliers", "edit"))):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    data = body.model_dump(exclude={"id"})
    for key, value in data.items():
        setattr(supplier, key, value)

    await db.commit()
    await db.refresh(supplier)
    return _to_response(supplier)


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("suppliers", "delete"))):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    await db.delete(supplier)
    await db.commit()
    return {"message": "Supplier deleted", "success": True}
