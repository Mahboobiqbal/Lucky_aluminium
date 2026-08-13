from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.customer import Customer
from models.expense import Expense
from models.inventory import InventoryItem
from models.order import Order
from utils.deps import require_permission

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("dashboard", "view"))):
    customers = (await db.execute(select(func.count(Customer.id)))).scalar() or 0
    orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    total_sales = (await db.execute(select(func.coalesce(func.sum(Order.total), 0)))).scalar() or 0
    total_paid = (await db.execute(select(func.coalesce(func.sum(Order.paid), 0)))).scalar() or 0
    total_expenses = (await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)))).scalar() or 0
    low_stock = (await db.execute(
        select(func.count(InventoryItem.id)).where(InventoryItem.current_stock < InventoryItem.min_stock)
    )).scalar() or 0

    return {
        "customers": customers,
        "orders": orders,
        "totalSales": float(total_sales),
        "totalPaid": float(total_paid),
        "totalExpenses": float(total_expenses),
        "profit": float(total_sales - total_expenses),
        "lowStockItems": low_stock,
    }


@router.get("/daily-sales")
async def daily_sales(date: str, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("reports", "view"))):
    result = await db.execute(
        select(Order).where(func.to_char(Order.order_date, "YYYY-MM-DD") == date)
    )
    orders = result.scalars().all()
    return [
        {
            "id": o.id,
            "number": o.number,
            "customerName": o.customer_name,
            "total": float(o.total),
            "paid": float(o.paid),
        }
        for o in orders
    ]


@router.get("/monthly-sales")
async def monthly_sales(month: str, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("reports", "view"))):
    result = await db.execute(
        select(Order).where(func.to_char(Order.order_date, "YYYY-MM") == month)
    )
    orders = result.scalars().all()
    return [
        {
            "id": o.id,
            "number": o.number,
            "customerName": o.customer_name,
            "total": float(o.total),
            "paid": float(o.paid),
        }
        for o in orders
    ]


@router.get("/stock")
async def stock_report(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("reports", "view"))):
    result = await db.execute(select(InventoryItem).order_by(InventoryItem.name))
    items = result.scalars().all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "category": i.category,
            "currentStock": float(i.current_stock),
            "minStock": float(i.min_stock),
            "costPrice": float(i.cost_price),
            "value": float(i.current_stock * i.cost_price),
            "lowStock": i.current_stock < i.min_stock,
        }
        for i in items
    ]


@router.get("/profit-loss")
async def profit_loss(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("reports", "view"))):
    total_sales = (await db.execute(select(func.coalesce(func.sum(Order.total), 0)))).scalar() or 0
    total_paid = (await db.execute(select(func.coalesce(func.sum(Order.paid), 0)))).scalar() or 0
    total_expenses = (await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)))).scalar() or 0

    return {
        "sales": float(total_sales),
        "paymentsReceived": float(total_paid),
        "expenses": float(total_expenses),
        "profit": float(total_sales - total_expenses),
    }
