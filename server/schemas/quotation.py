from datetime import datetime

from pydantic import BaseModel, Field, field_validator


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

    @field_validator("quantity", mode="before")
    @classmethod
    def qty_positive(cls, v):
        if int(v) < 1:
            raise ValueError("Quantity must be at least 1")
        return int(v)

    @field_validator("unitPrice", mode="before")
    @classmethod
    def unitPrice_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Unit price cannot be negative")
        return float(v)

    @field_validator("amount", mode="before")
    @classmethod
    def amount_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Amount cannot be negative")
        return float(v)


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

    @field_validator("subtotal", mode="before")
    @classmethod
    def subtotal_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Subtotal cannot be negative")
        return float(v)

    @field_validator("discount", mode="before")
    @classmethod
    def discount_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Discount cannot be negative")
        return float(v)

    @field_validator("extraCharges", mode="before")
    @classmethod
    def extraCharges_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Extra charges cannot be negative")
        return float(v)

    @field_validator("total", mode="before")
    @classmethod
    def total_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Total cannot be negative")
        return float(v)


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
