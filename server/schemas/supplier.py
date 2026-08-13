from datetime import datetime

from pydantic import BaseModel, Field


class SupplierBase(BaseModel):
    name: str
    company: str | None = None
    contact: str
    mobile: str | None = None
    city: str | None = None
    email: str | None = None
    address: str | None = None
    products: str | None = None
    notes: str | None = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(SupplierBase):
    id: int


class SupplierResponse(SupplierBase):
    id: int
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
