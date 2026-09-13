"""rename item types: window→length, other→window

Revision ID: 009
Revises: 008
Create Date: 2026-09-13 00:00:00
"""
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE order_items SET item_type = 'length' WHERE item_type = 'window'")
    op.execute("UPDATE order_items SET item_type = 'window' WHERE item_type = 'other'")
    op.execute("UPDATE invoice_items SET item_type = 'length' WHERE item_type = 'window'")
    op.execute("UPDATE invoice_items SET item_type = 'window' WHERE item_type = 'other'")
    op.execute("UPDATE purchase_items SET item_type = 'length' WHERE item_type = 'window'")
    op.execute("UPDATE purchase_items SET item_type = 'window' WHERE item_type = 'other'")
    op.execute("UPDATE quotation_items SET item_type = 'length' WHERE item_type = 'window'")
    op.execute("UPDATE quotation_items SET item_type = 'window' WHERE item_type = 'other'")
    op.execute("UPDATE inventory SET item_type = 'length' WHERE item_type = 'window'")
    op.execute("UPDATE inventory SET item_type = 'window' WHERE item_type = 'other'")


def downgrade() -> None:
    op.execute("UPDATE inventory SET item_type = 'other' WHERE item_type = 'window'")
    op.execute("UPDATE inventory SET item_type = 'window' WHERE item_type = 'length'")
    op.execute("UPDATE quotation_items SET item_type = 'other' WHERE item_type = 'window'")
    op.execute("UPDATE quotation_items SET item_type = 'window' WHERE item_type = 'length'")
    op.execute("UPDATE purchase_items SET item_type = 'other' WHERE item_type = 'window'")
    op.execute("UPDATE purchase_items SET item_type = 'window' WHERE item_type = 'length'")
    op.execute("UPDATE invoice_items SET item_type = 'other' WHERE item_type = 'window'")
    op.execute("UPDATE invoice_items SET item_type = 'window' WHERE item_type = 'length'")
    op.execute("UPDATE order_items SET item_type = 'other' WHERE item_type = 'window'")
    op.execute("UPDATE order_items SET item_type = 'window' WHERE item_type = 'length'")
