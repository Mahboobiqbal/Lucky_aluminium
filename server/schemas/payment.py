from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class PaymentBase(BaseModel):
    invoiceId: int | None = None
    orderId: int | None = None
    customerId: int | None = None
    customerName: str | None = None
    supplierId: int | None = None
    supplierName: str | None = None
    amount: float = 0
    method: str
    date: datetime
    notes: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def amount_positive(cls, v):
        if float(v) <= 0:
            raise ValueError("Amount must be greater than 0")
        return float(v)


class PaymentCreate(PaymentBase):
    pass


class PaymentResponse(PaymentBase):
    id: int
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
