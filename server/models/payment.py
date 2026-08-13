from datetime import datetime

from sqlalchemy import ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), default=None)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), default=None)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), default=None)
    customer_name: Mapped[str | None] = mapped_column(String(200), default=None)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), default=None)
    supplier_name: Mapped[str | None] = mapped_column(String(200), default=None)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    method: Mapped[str] = mapped_column(String(50))
    date: Mapped[datetime] = mapped_column()
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
