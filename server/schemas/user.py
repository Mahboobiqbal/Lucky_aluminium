from datetime import datetime

from pydantic import BaseModel, Field


class UserPermissionBase(BaseModel):
    moduleKey: str
    canView: bool = True
    canCreate: bool = True
    canEdit: bool = True
    canDelete: bool = True
    canPrint: bool = True
    canExport: bool = True


class UserPermissionResponse(UserPermissionBase):
    id: int
    userId: int

    model_config = {"from_attributes": True}


class UserBase(BaseModel):
    fullName: str
    username: str
    email: str
    phone: str = ""
    status: str = "active"
    role: str = "user"


class UserCreate(UserBase):
    password: str
    permissions: list[UserPermissionBase] = []


class UserUpdate(UserBase):
    id: int
    password: str | None = None
    permissions: list[UserPermissionBase] = []


class UserResponse(BaseModel):
    id: int
    fullName: str
    username: str
    email: str
    phone: str
    status: str
    role: str
    createdAt: datetime = Field(alias="created_at")

    model_config = {"from_attributes": True}


class UserWithPermissions(UserResponse):
    permissions: list[UserPermissionResponse] = []
