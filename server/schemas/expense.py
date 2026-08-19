from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ExpenseBase(BaseModel):
    category: str
    amount: float = 0
    date: datetime
    description: str | None = None
    createdBy: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def amount_positive(cls, v):
        if float(v) <= 0:
            raise ValueError("Amount must be greater than 0")
        return float(v)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseResponse(ExpenseBase):
    id: int
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
