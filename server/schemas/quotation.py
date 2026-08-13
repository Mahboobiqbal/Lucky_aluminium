from datetime import datetime

from pydantic import BaseModel, Field


class QuotationItemBase(BaseModel):
    productId: int | None = None
    productName: str
    itemType: str = "other"
    width: float = 0
    height: float = 0
    length: float = 0
    sqft: float | None = None
    quantity: int = 1
    unitPrice: float = 0
    amount: float = 0
    notes: str | None = None


class QuotationItemCreate(QuotationItemBase):
    pass


class QuotationItemResponse(QuotationItemBase):
    id: int

    model_config = {"from_attributes": True}


class QuotationBase(BaseModel):
    number: str
    customerId: int
    customerName: str
    date: datetime
    subtotal: float = 0
    discount: float = 0
    extraCharges: float = 0
    total: float = 0
    status: str = "draft"
    notes: str | None = None


class QuotationCreate(QuotationBase):
    items: list[QuotationItemCreate] = []


class QuotationUpdate(QuotationBase):
    id: int
    items: list[QuotationItemCreate] = []


class QuotationResponse(QuotationBase):
    id: int
    items: list[QuotationItemResponse] = []
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
