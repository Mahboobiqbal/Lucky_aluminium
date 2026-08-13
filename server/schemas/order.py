from datetime import datetime

from pydantic import BaseModel, Field


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
    total: float = 0
    paid: float = 0
    status: str = "pending"
    notes: str | None = None


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
