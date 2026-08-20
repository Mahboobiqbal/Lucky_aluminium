import os
import sys
from pydantic_settings import BaseSettings


def _env_path() -> str:
    if getattr(sys, "frozen", False):
        # One-folder PyInstaller build: .env is in _MEIPASS (bundled)
        if hasattr(sys, "_MEIPASS"):
            bundled = os.path.join(sys._MEIPASS, ".env")
            if os.path.isfile(bundled):
                return bundled
        # One-file build or Electron: .env is next to the .exe
        exe_dir = os.path.dirname(sys.executable)
        return os.path.join(exe_dir, ".env")
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
