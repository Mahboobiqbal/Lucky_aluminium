from datetime import datetime

from pydantic import BaseModel, Field


class InventoryItemBase(BaseModel):
    name: str
    category: str
    unit: str
    currentStock: float = 0
    minStock: float = 0
    costPrice: float = 0
    supplier: str | None = None
    widthFt: float = 0
    heightFt: float = 0
    stockQty: float = 0


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(InventoryItemBase):
    id: int


class InventoryItemResponse(InventoryItemBase):
    id: int
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
