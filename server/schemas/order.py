from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class OrderItemBase(BaseModel):
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


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: int

    model_config = {"from_attributes": True}


class OrderBase(BaseModel):
    number: str
    customerId: int
    customerName: str
    quotationId: int | None = None
    orderDate: datetime
    deliveryDate: datetime | None = None
    subtotal: float = 0
    discountPercent: float = 0
    total: float = 0
    paid: float = 0
    previousBalance: float = 0
    status: str = "pending"
    notes: str | None = None

    @field_validator("subtotal", mode="before")
    @classmethod
    def subtotal_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Subtotal cannot be negative")
        return float(v)

    @field_validator("discountPercent", mode="before")
    @classmethod
    def discount_valid(cls, v):
        if float(v) < 0 or float(v) > 100:
            raise ValueError("Discount must be between 0 and 100")
        return float(v)

    @field_validator("total", mode="before")
    @classmethod
    def total_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Total cannot be negative")
        return float(v)

    @field_validator("paid", mode="before")
    @classmethod
    def paid_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Paid amount cannot be negative")
        return float(v)


class OrderCreate(OrderBase):
    items: list[OrderItemCreate] = []


class OrderUpdate(OrderBase):
    id: int
    items: list[OrderItemCreate] = []


class OrderResponse(OrderBase):
    id: int
    items: list[OrderItemResponse] = []
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
