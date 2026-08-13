"""
Create the database if it doesn't exist, then run the server.
Usage: uv run python scripts/setup_db.py
"""
import asyncio
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings


def parse_db_url(url: str):
    """Extract database name and base URL from the connection string."""
    # postgresql+asyncpg://user:pass@host:port/dbname
    match = re.match(r"(postgresql\+asyncpg://[^/]+)/(\w+)", url)
    if not match:
        raise ValueError(f"Cannot parse DATABASE_URL: {url}")
    base_url = match.group(1)
    db_name = match.group(2)
    return base_url, db_name


async def create_database():
    import asyncpg

    base_url, db_name = parse_db_url(settings.DATABASE_URL)

    # Convert asyncpg URL to plain psycopg2-style for admin commands
    # postgresql+asyncpg://user:pass@host:port → postgresql://user:pass@host:port
    admin_url = base_url.replace("+asyncpg", "")

    try:
        conn = await asyncpg.connect(admin_url)
        # Check if database exists
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )
        if not exists:
            # Can't use parameterized query for CREATE DATABASE
            await conn.execute(f'CREATE DATABASE "{db_name}"')
            print(f"Database '{db_name}' created successfully.")
        else:
            print(f"Database '{db_name}' already exists.")
        await conn.close()
    except Exception as e:
        print(f"Warning: Could not auto-create database: {e}")
        print(f"Please create it manually: CREATE DATABASE {db_name};")
        print(f"Or connect to PostgreSQL and run: createdb {db_name}")


if __name__ == "__main__":
    asyncio.run(create_database())
