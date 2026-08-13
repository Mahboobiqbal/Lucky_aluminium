from datetime import datetime

from sqlalchemy import Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Backup(Base):
    __tablename__ = "backups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    size: Mapped[int] = mapped_column(Integer, default=0)
    tables: Mapped[str | None] = mapped_column(Text, default=None)
    data: Mapped[str | None] = mapped_column(Text, default=None)
    filename: Mapped[str | None] = mapped_column(String(200), default=None)
