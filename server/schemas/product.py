from datetime import datetime

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    code: str
    name: str
    category: str
    openingType: str | None = None
    profileSeries: str | None = None
    glassType: str | None = None
    glassThickness: str | None = None
    frameColor: str | None = None
    handleType: str | None = None
    lockType: str | None = None
    unit: str
    basePrice: float = 0
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
