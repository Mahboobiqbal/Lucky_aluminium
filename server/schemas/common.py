from pydantic import BaseModel, Field


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    pageSize: int


class MessageResponse(BaseModel):
    message: str
    success: bool = True
