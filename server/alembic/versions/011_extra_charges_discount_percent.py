"""Add extra charges and change discount to percent
Revision ID: 011
Revises: 010
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"

def upgrade():
    op.add_column("products", sa.Column("extra_charges", sa.Numeric(12, 2), server_default="0"))
    op.add_column("orders", sa.Column("extra_charges", sa.Numeric(12, 2), server_default="0"))
    with op.batch_alter_table("quotations") as batch_op:
        batch_op.alter_column("discount", new_column_name="discount_percent", type_=sa.Numeric(5, 2), server_default="0")

def downgrade():
    with op.batch_alter_table("quotations") as batch_op:
        batch_op.alter_column("discount_percent", new_column_name="discount", type_=sa.Numeric(12, 2), server_default="0")
    op.drop_column("orders", "extra_charges")
    op.drop_column("products", "extra_charges")
