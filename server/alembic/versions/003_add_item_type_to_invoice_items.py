"""add item_type and length to invoice_items

Revision ID: 003
Revises: 002
Create Date: 2025-03-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoice_items", sa.Column("item_type", sa.String(20), server_default="other"))
    op.add_column("invoice_items", sa.Column("length", sa.Numeric(10, 2), server_default="0"))


def downgrade() -> None:
    op.drop_column("invoice_items", "length")
    op.drop_column("invoice_items", "item_type")
