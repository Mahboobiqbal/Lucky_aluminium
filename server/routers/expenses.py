from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.expense import Expense
from schemas.expense import ExpenseCreate, ExpenseResponse
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def _to_response(e: Expense) -> dict:
    return {
        "id": e.id,
        "category": e.category,
        "amount": float(e.amount),
        "date": e.date,
        "description": e.description,
        "createdBy": e.created_by,
        "createdAt": e.created_at,
    }


@router.get("")
async def list_expenses(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("expenses", "view"))):
    result = await db.execute(select(Expense).order_by(Expense.date.desc()))
    return [_to_response(e) for e in result.scalars().all()]


@router.get("/{expense_id}")
async def get_expense(expense_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("expenses", "view"))):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    return _to_response(e)


@router.post("")
async def create_expense(body: ExpenseCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("expenses", "create"))):
    expense = Expense(
        category=body.category,
        amount=body.amount,
        date=naive(body.date),
        description=body.description,
        created_by=body.createdBy,
        created_at=datetime.utcnow(),
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return _to_response(expense)


@router.delete("/{expense_id}")
async def delete_expense(expense_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("expenses", "delete"))):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")

    await db.delete(e)
    await db.commit()
    return {"message": "Expense deleted", "success": True}
