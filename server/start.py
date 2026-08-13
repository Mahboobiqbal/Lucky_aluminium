"""
One-command setup: create database, seed admin, start server.
Usage: uv run python start.py
"""
import asyncio
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    print("=== UDYANA ERP Server Setup ===\n")

    # Step 1: Create database if needed
    print("[1/3] Checking database...")
    from scripts.setup_db import create_database
    asyncio.run(create_database())

    # Step 2: Seed admin user
    print("\n[2/3] Seeding admin user...")
    from scripts.create_admin import main as seed_admin
    asyncio.run(seed_admin())

    # Step 3: Start server
    print("\n[3/3] Starting server...")
    print("=" * 40)
    subprocess.run(
        [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
    )


if __name__ == "__main__":
    main()
