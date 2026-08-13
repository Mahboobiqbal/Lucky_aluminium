from datetime import datetime

from pydantic import BaseModel, Field


class CustomerBase(BaseModel):
    code: str
    name: str
    mobile: str
    whatsapp: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    id: int


class CustomerResponse(CustomerBase):
    id: int
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
