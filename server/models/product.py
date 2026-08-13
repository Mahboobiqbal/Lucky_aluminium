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
    opening_type: Mapped[str | None] = mapped_column(String(100), default=None)
    profile_series: Mapped[str | None] = mapped_column(String(100), default=None)
    glass_type: Mapped[str | None] = mapped_column(String(100), default=None)
    glass_thickness: Mapped[str | None] = mapped_column(String(50), default=None)
    frame_color: Mapped[str | None] = mapped_column(String(50), default=None)
    handle_type: Mapped[str | None] = mapped_column(String(100), default=None)
    lock_type: Mapped[str | None] = mapped_column(String(100), default=None)
    unit: Mapped[str] = mapped_column(String(20))
    base_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
