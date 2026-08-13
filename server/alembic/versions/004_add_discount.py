"""add subtotal and discount_percent to orders

Revision ID: 004
Revises: 003
Create Date: 2025-04-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("subtotal", sa.Numeric(12, 2), server_default="0"))
    op.add_column("orders", sa.Column("discount_percent", sa.Numeric(5, 2), server_default="0"))


def downgrade() -> None:
    op.drop_column("orders", "discount_percent")
    op.drop_column("orders", "subtotal")
