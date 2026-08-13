from datetime import datetime

from pydantic import BaseModel, Field


class BackupResponse(BaseModel):
    id: int
    type: str
    createdAt: datetime = Field(alias="created_at")
    size: int
    tables: str | None = None
    filename: str | None = None

    model_config = {"from_attributes": True}
