from datetime import datetime

from pydantic import BaseModel, Field


class ExpenseBase(BaseModel):
    category: str
    amount: float = 0
    date: datetime
    description: str | None = None
    createdBy: str | None = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseResponse(ExpenseBase):
    id: int
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
