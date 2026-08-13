from datetime import datetime

from pydantic import BaseModel, Field


class MeasurementBase(BaseModel):
    customerName: str
    style: str
    date: datetime
    fields: str
    notes: str | None = None


class MeasurementCreate(MeasurementBase):
    pass


class MeasurementResponse(MeasurementBase):
    id: int
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}
