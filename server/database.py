import os
import sys
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("sqlite") and "./" in db_url:
    if getattr(sys, "frozen", False):
        db_dir = os.path.dirname(sys.executable)
    else:
        db_dir = os.path.dirname(os.path.abspath(__file__))
    db_url = db_url.replace("sqlite+aiosqlite:///./", f"sqlite+aiosqlite:///{db_dir}/")

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
engine = create_async_engine(db_url, echo=False, connect_args=connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session
