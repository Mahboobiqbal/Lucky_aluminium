from datetime import datetime

from pydantic import BaseModel, Field


class CustomerBase(BaseModel):
    code: str = ""
    name: str
    mobile: str = ""
    whatsapp: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    notes: str | None = None
    previousBalance: float = 0


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    id: int


class CustomerResponse(CustomerBase):
    id: int
    createdAt: datetime = Field(alias="created_at")
    previousBalance: float = Field(default=0, validation_alias="previous_balance", serialization_alias="previousBalance")

    model_config = {"from_attributes": True, "populate_by_name": True}
