from datetime import datetime

from pydantic import BaseModel, Field


class PurchaseItemBase(BaseModel):
    productName: str
    itemType: str = "other"
    widthFt: float = 0
    heightFt: float = 0
    length: float = 0
    quantity: int = 1
    purchasePrice: float = 0
    salePrice: float = 0
    amount: float = 0


class PurchaseItemCreate(PurchaseItemBase):
    pass


class PurchaseItemResponse(PurchaseItemBase):
    id: int

    model_config = {"from_attributes": True}


class PurchaseBase(BaseModel):
    invoiceNumber: str
    supplierId: int
    supplierName: str
    paymentType: str
    totalAmount: float = 0
    date: datetime
    notes: str | None = None


class PurchaseCreate(PurchaseBase):
    items: list[PurchaseItemCreate] = []


class PurchaseResponse(PurchaseBase):
    id: int
    items: list[PurchaseItemResponse] = []
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
