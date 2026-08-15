"""add item_type and length to purchase_items

Revision ID: 006
Revises: 005
Create Date: 2026-08-14
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("purchase_items", sa.Column("item_type", sa.String(20), server_default="other"))
    op.add_column("purchase_items", sa.Column("length", sa.Numeric(12, 2), server_default="0"))


def downgrade() -> None:
    op.drop_column("purchase_items", "length")
    op.drop_column("purchase_items", "item_type")
