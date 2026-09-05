from datetime import datetime

from sqlalchemy import ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    number: Mapped[str] = mapped_column(String(30), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    customer_name: Mapped[str] = mapped_column(String(200))
    quotation_id: Mapped[int | None] = mapped_column(ForeignKey("quotations.id"), default=None)
    order_date: Mapped[datetime] = mapped_column()
    delivery_date: Mapped[datetime | None] = mapped_column(default=None)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    previous_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), default=None)
    product_name: Mapped[str] = mapped_column(String(200))
    item_type: Mapped[str] = mapped_column(String(20), default="other")
    width: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    height: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    length: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    sqft: Mapped[float | None] = mapped_column(Numeric(10, 2), default=None)
    quantity: Mapped[int] = mapped_column(default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    order: Mapped["Order"] = relationship(back_populates="items")
