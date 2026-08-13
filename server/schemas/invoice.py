from datetime import datetime

from pydantic import BaseModel, Field


class InvoiceItemBase(BaseModel):
    productName: str
    width: float = 0
    height: float = 0
    quantity: int = 1
    unitPrice: float = 0
    amount: float = 0
    notes: str | None = None


class InvoiceItemResponse(InvoiceItemBase):
    id: int

    model_config = {"from_attributes": True}


class InvoiceBase(BaseModel):
    number: str
    orderId: int | None = None
    customerId: int
    customerName: str
    date: datetime
    subtotal: float = 0
    discount: float = 0
    extraCharges: float = 0
    total: float = 0
    paid: float = 0


class InvoiceResponse(InvoiceBase):
    id: int
    items: list[InvoiceItemResponse] = []
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
