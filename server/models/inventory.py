from datetime import datetime

from sqlalchemy import Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class InventoryItem(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(20))
    item_type: Mapped[str] = mapped_column(String(20), default="other")
    current_stock: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    min_stock: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cost_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    supplier: Mapped[str | None] = mapped_column(String(200), default=None)
    width_ft: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    height_ft: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    length: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    stock_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
