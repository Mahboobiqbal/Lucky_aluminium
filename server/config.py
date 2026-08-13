import os
import sys
from pydantic_settings import BaseSettings


def _env_path() -> str:
    if getattr(sys, "frozen", False):
        base = sys._MEIPASS
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, ".env")


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./udyana.db"
    SECRET_KEY: str = "udyana-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    ALGORITHM: str = "HS256"

    model_config = {"env_file": _env_path(), "env_file_encoding": "utf-8"}


settings = Settings()
