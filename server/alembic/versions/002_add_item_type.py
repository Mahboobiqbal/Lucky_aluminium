"""add item_type and length to order_items

Revision ID: 002
Revises: 001
Create Date: 2025-02-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("order_items", sa.Column("item_type", sa.String(20), server_default="other"))
    op.add_column("order_items", sa.Column("length", sa.Numeric(10, 2), server_default="0"))


def downgrade() -> None:
    op.drop_column("order_items", "length")
    op.drop_column("order_items", "item_type")
