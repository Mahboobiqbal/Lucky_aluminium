from datetime import datetime

from sqlalchemy import ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_number: Mapped[str] = mapped_column(String(30), index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    supplier_name: Mapped[str] = mapped_column(String(200))
    payment_type: Mapped[str] = mapped_column(String(30))
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    date: Mapped[datetime] = mapped_column()
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    items: Mapped[list["PurchaseItem"]] = relationship(back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"))
    product_name: Mapped[str] = mapped_column(String(200))
    width_ft: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    height_ft: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    quantity: Mapped[int] = mapped_column(default=1)
    purchase_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sale_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    purchase: Mapped["Purchase"] = relationship(back_populates="items")
