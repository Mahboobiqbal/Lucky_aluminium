from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class PurchaseItemBase(BaseModel):
    productName: str
    itemType: str = "other"
    pricingMode: str = "piece"
    widthFt: float = 0
    heightFt: float = 0
    length: float = 0
    quantity: int = 1
    purchasePrice: float = 0
    salePrice: float = 0
    amount: float = 0

    @field_validator("quantity", mode="before")
    @classmethod
    def qty_positive(cls, v):
        if int(v) < 1:
            raise ValueError("Quantity must be at least 1")
        return int(v)

    @field_validator("purchasePrice", mode="before")
    @classmethod
    def purchasePrice_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Purchase price cannot be negative")
        return float(v)

    @field_validator("salePrice", mode="before")
    @classmethod
    def salePrice_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Sale price cannot be negative")
        return float(v)

    @field_validator("amount", mode="before")
    @classmethod
    def amount_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Amount cannot be negative")
        return float(v)


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

    @field_validator("totalAmount", mode="before")
    @classmethod
    def totalAmount_non_negative(cls, v):
        if float(v) < 0:
            raise ValueError("Total amount cannot be negative")
        return float(v)


class PurchaseCreate(PurchaseBase):
    items: list[PurchaseItemCreate] = []


class PurchaseResponse(PurchaseBase):
    id: int
    items: list[PurchaseItemResponse] = []
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
