from datetime import datetime

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    code: str
    name: str
    category: str
    color: str | None = None
    size: str | None = None
    gaze: str | None = None
    unit: str
    basePrice: float = 0
    extraCharges: float = 0
    description: str | None = None
    active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    id: int


class ProductResponse(ProductBase):
    id: int
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
