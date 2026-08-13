"""
Standalone script to create/update the admin user.
Usage: uv run python scripts/create_admin.py
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy import select

from config import settings
from database import async_session, engine
from models import Base
from models.user import User, UserPermission

MODULES = [
    "dashboard", "customers", "quotations", "orders", "invoices",
    "payments", "paymentReceipts", "purchase", "suppliers", "products",
    "measurements", "inventory", "expenses", "reports",
    "dailyPaymentStatement", "settings", "backup",
]


async def main():
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Admin user already exists (id={existing.id}). Updating password...")
            existing.password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
            await db.commit()
            print("Password updated to: admin123")
        else:
            admin = User(
                full_name="System Administrator",
                username="admin",
                email="admin@udyana.example",
                phone="",
                password_hash=bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode(),
                status="active",
                role="admin",
            )
            db.add(admin)
            await db.flush()

            for mod in MODULES:
                db.add(UserPermission(
                    user_id=admin.id,
                    module_key=mod,
                    can_view=True,
                    can_create=True,
                    can_edit=True,
                    can_delete=True,
                    can_print=True,
                    can_export=True,
                ))

            await db.commit()
            print(f"Admin user created (id={admin.id})")
            print("  Username: admin")
            print("  Password: admin123")
            print("  Role: admin")

    print("\nDone! You can now start the server with:")
    print("  uv run uvicorn main:app --reload --port 8000")


if __name__ == "__main__":
    asyncio.run(main())
