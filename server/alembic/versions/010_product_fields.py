"""Replace product fields: color, size, gaze

Revision ID: 010
Revises: 009
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns
    op.add_column("products", sa.Column("color", sa.String(100), nullable=True))
    op.add_column("products", sa.Column("size", sa.String(100), nullable=True))
    op.add_column("products", sa.Column("gaze", sa.String(100), nullable=True))

    # Drop old columns
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("opening_type")
        batch_op.drop_column("profile_series")
        batch_op.drop_column("glass_type")
        batch_op.drop_column("glass_thickness")
        batch_op.drop_column("frame_color")
        batch_op.drop_column("handle_type")
        batch_op.drop_column("lock_type")


def downgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("gaze")
        batch_op.drop_column("size")
        batch_op.drop_column("color")
        batch_op.add_column(sa.Column("opening_type", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("profile_series", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("glass_type", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("glass_thickness", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("frame_color", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("handle_type", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("lock_type", sa.String(100), nullable=True))
