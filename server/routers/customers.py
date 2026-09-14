from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.customer import Customer
from models.invoice import Invoice
from models.order import Order
from models.payment import Payment
from models.quotation import Quotation
from schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=list[CustomerResponse])
async def list_customers(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("customers", "view"))):
    result = await db.execute(select(Customer).order_by(Customer.created_at.desc()))
    return result.scalars().all()


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("customers", "view"))):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.post("", response_model=CustomerResponse)
async def create_customer(body: CustomerCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("customers", "create"))):
    data = body.model_dump()
    if not data.get("code"):
        result = await db.execute(select(Customer).order_by(Customer.id.desc()).limit(1))
        last = result.scalar_one_or_none()
        next_num = (last.id + 1) if last else 1
        data["code"] = f"CUS-{str(next_num).zfill(4)}"

        existing = await db.execute(select(Customer).where(Customer.code == data["code"]))
        while existing.scalar_one_or_none():
            next_num += 1
            data["code"] = f"CUS-{str(next_num).zfill(4)}"
            existing = await db.execute(select(Customer).where(Customer.code == data["code"]))
    else:
        existing = await db.execute(select(Customer).where(Customer.code == data["code"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Customer code already exists")

    customer = Customer(
        code=data["code"],
        name=data["name"],
        mobile=data.get("mobile", ""),
        whatsapp=data.get("whatsapp"),
        email=data.get("email"),
        address=data.get("address"),
        city=data.get("city"),
        notes=data.get("notes"),
        previous_balance=data.get("previousBalance", 0),
        created_at=datetime.utcnow(),
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: int, body: CustomerUpdate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("customers", "edit"))):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = body.model_dump(exclude={"id"})
    
    if "code" in data and data["code"]:
        existing = await db.execute(select(Customer).where(Customer.code == data["code"], Customer.id != customer_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Customer code already exists")
    
    customer.code = data.get("code", customer.code)
    customer.name = data.get("name", customer.name)
    customer.mobile = data.get("mobile", customer.mobile)
    customer.whatsapp = data.get("whatsapp", customer.whatsapp)
    customer.email = data.get("email", customer.email)
    customer.address = data.get("address", customer.address)
    customer.city = data.get("city", customer.city)
    customer.notes = data.get("notes", customer.notes)
    customer.previous_balance = data.get("previousBalance", customer.previous_balance)

    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("customers", "delete"))):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    orders = await db.execute(select(Order).where(Order.customer_id == customer_id).limit(1))
    if orders.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete customer with existing orders. Remove orders first.")

    payments = await db.execute(select(Payment).where(Payment.customer_id == customer_id).limit(1))
    if payments.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete customer with existing payments. Remove payments first.")

    quotations = await db.execute(select(Quotation).where(Quotation.customer_id == customer_id).limit(1))
    if quotations.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete customer with existing quotations. Remove quotations first.")

    invoices = await db.execute(select(Invoice).where(Invoice.customer_id == customer_id).limit(1))
    if invoices.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete customer with existing invoices. Remove invoices first.")

    await db.delete(customer)
    await db.commit()
    return {"message": "Customer deleted", "success": True}
