from datetime import datetime

from sqlalchemy import Boolean, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(100), default=None)
    size: Mapped[str | None] = mapped_column(String(100), default=None)
    gaze: Mapped[str | None] = mapped_column(String(100), default=None)
    unit: Mapped[str] = mapped_column(String(20))
    base_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    extra_charges: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
