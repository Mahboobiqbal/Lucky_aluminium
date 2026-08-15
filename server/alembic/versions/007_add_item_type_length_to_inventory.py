"""add item_type and length to inventory

Revision ID: 007
Revises: 006
Create Date: 2026-08-14
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inventory", sa.Column("item_type", sa.String(20), server_default="other"))
    op.add_column("inventory", sa.Column("length", sa.Numeric(12, 2), server_default="0"))


def downgrade() -> None:
    op.drop_column("inventory", "length")
    op.drop_column("inventory", "item_type")
