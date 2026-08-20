import os
import sys
from pydantic_settings import BaseSettings


def _env_path() -> str:
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        env_path = os.path.join(exe_dir, ".env")
        if os.path.isfile(env_path):
            return env_path
        return env_path
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, ".env")


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./udyana.db"
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"

    INITIAL_ADMIN_USERNAME: str = ""
    INITIAL_ADMIN_PASSWORD: str = ""

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8000"

    model_config = {"env_file": _env_path(), "env_file_encoding": "utf-8"}


settings = Settings()


def validate_settings():
    errors = []
    if not settings.SECRET_KEY:
        errors.append("SECRET_KEY is required in .env")
    if not settings.INITIAL_ADMIN_USERNAME:
        errors.append("INITIAL_ADMIN_USERNAME is required in .env")
    if not settings.INITIAL_ADMIN_PASSWORD:
        errors.append("INITIAL_ADMIN_PASSWORD is required in .env")
    elif len(settings.INITIAL_ADMIN_PASSWORD) < 8:
        errors.append("INITIAL_ADMIN_PASSWORD must be at least 8 characters")
    if errors:
        raise RuntimeError("Configuration error:\n" + "\n".join(f"  - {e}" for e in errors))
