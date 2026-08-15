"""add pricing_mode to inventory and purchase_items

Revision ID: 008
Revises: 007
Create Date: 2026-08-16 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inventory", sa.Column("pricing_mode", sa.String(10), server_default="piece"))
    op.add_column("purchase_items", sa.Column("pricing_mode", sa.String(10), server_default="piece"))


def downgrade() -> None:
    op.drop_column("purchase_items", "pricing_mode")
    op.drop_column("inventory", "pricing_mode")
