from pydantic import BaseModel, Field


class SettingBase(BaseModel):
    key: str
    value: str


class SettingUpdate(BaseModel):
    key: str
    value: str


class SettingResponse(BaseModel):
    key: str
    value: str

    model_config = {"from_attributes": True}
