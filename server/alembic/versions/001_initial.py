"""initial migration

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(20), index=True),
        sa.Column("name", sa.String(200)),
        sa.Column("mobile", sa.String(30)),
        sa.Column("whatsapp", sa.String(30), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(20), index=True),
        sa.Column("name", sa.String(200)),
        sa.Column("category", sa.String(100)),
        sa.Column("opening_type", sa.String(100), nullable=True),
        sa.Column("profile_series", sa.String(100), nullable=True),
        sa.Column("glass_type", sa.String(100), nullable=True),
        sa.Column("glass_thickness", sa.String(50), nullable=True),
        sa.Column("frame_color", sa.String(50), nullable=True),
        sa.Column("handle_type", sa.String(100), nullable=True),
        sa.Column("lock_type", sa.String(100), nullable=True),
        sa.Column("unit", sa.String(20)),
        sa.Column("base_price", sa.Numeric(12, 2), server_default="0"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200)),
        sa.Column("company", sa.String(200), nullable=True),
        sa.Column("contact", sa.String(100)),
        sa.Column("mobile", sa.String(30), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("products", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "quotations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("number", sa.String(30), index=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id")),
        sa.Column("customer_name", sa.String(200)),
        sa.Column("date", sa.DateTime()),
        sa.Column("subtotal", sa.Numeric(12, 2), server_default="0"),
        sa.Column("discount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("extra_charges", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "quotation_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("quotation_id", sa.Integer(), sa.ForeignKey("quotations.id", ondelete="CASCADE")),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("product_name", sa.String(200)),
        sa.Column("width", sa.Numeric(10, 2), server_default="0"),
        sa.Column("height", sa.Numeric(10, 2), server_default="0"),
        sa.Column("sqft", sa.Numeric(10, 2), nullable=True),
        sa.Column("quantity", sa.Integer(), server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), server_default="0"),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("number", sa.String(30), index=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id")),
        sa.Column("customer_name", sa.String(200)),
        sa.Column("quotation_id", sa.Integer(), sa.ForeignKey("quotations.id"), nullable=True),
        sa.Column("order_date", sa.DateTime()),
        sa.Column("delivery_date", sa.DateTime(), nullable=True),
        sa.Column("total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("paid", sa.Numeric(12, 2), server_default="0"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE")),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("product_name", sa.String(200)),
        sa.Column("width", sa.Numeric(10, 2), server_default="0"),
        sa.Column("height", sa.Numeric(10, 2), server_default="0"),
        sa.Column("sqft", sa.Numeric(10, 2), nullable=True),
        sa.Column("quantity", sa.Integer(), server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), server_default="0"),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("number", sa.String(30), index=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id")),
        sa.Column("customer_name", sa.String(200)),
        sa.Column("date", sa.DateTime()),
        sa.Column("subtotal", sa.Numeric(12, 2), server_default="0"),
        sa.Column("discount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("extra_charges", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("paid", sa.Numeric(12, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "invoice_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id", ondelete="CASCADE")),
        sa.Column("product_name", sa.String(200)),
        sa.Column("width", sa.Numeric(10, 2), server_default="0"),
        sa.Column("height", sa.Numeric(10, 2), server_default="0"),
        sa.Column("quantity", sa.Integer(), server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), server_default="0"),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=True),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id"), nullable=True),
        sa.Column("supplier_name", sa.String(200), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("method", sa.String(50)),
        sa.Column("date", sa.DateTime()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("category", sa.String(100)),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("date", sa.DateTime()),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "purchases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("invoice_number", sa.String(30), index=True),
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id")),
        sa.Column("supplier_name", sa.String(200)),
        sa.Column("payment_type", sa.String(30)),
        sa.Column("total_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("date", sa.DateTime()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "purchase_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("purchase_id", sa.Integer(), sa.ForeignKey("purchases.id", ondelete="CASCADE")),
        sa.Column("product_name", sa.String(200)),
        sa.Column("quantity", sa.Integer(), server_default="1"),
        sa.Column("purchase_price", sa.Numeric(12, 2), server_default="0"),
        sa.Column("sale_price", sa.Numeric(12, 2), server_default="0"),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0"),
    )

    op.create_table(
        "inventory",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200)),
        sa.Column("category", sa.String(100)),
        sa.Column("unit", sa.String(20)),
        sa.Column("current_stock", sa.Numeric(12, 2), server_default="0"),
        sa.Column("min_stock", sa.Numeric(12, 2), server_default="0"),
        sa.Column("cost_price", sa.Numeric(12, 2), server_default="0"),
        sa.Column("supplier", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "measurements",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("customer_name", sa.String(200)),
        sa.Column("style", sa.String(100)),
        sa.Column("date", sa.DateTime()),
        sa.Column("fields", sa.Text()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text(), server_default=""),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("full_name", sa.String(200)),
        sa.Column("username", sa.String(100), unique=True, index=True),
        sa.Column("email", sa.String(200)),
        sa.Column("phone", sa.String(30), server_default=""),
        sa.Column("password_hash", sa.String(200)),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("role", sa.String(20), server_default="user"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "user_permissions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("module_key", sa.String(50)),
        sa.Column("can_view", sa.Boolean(), server_default="true"),
        sa.Column("can_create", sa.Boolean(), server_default="true"),
        sa.Column("can_edit", sa.Boolean(), server_default="true"),
        sa.Column("can_delete", sa.Boolean(), server_default="true"),
        sa.Column("can_print", sa.Boolean(), server_default="true"),
        sa.Column("can_export", sa.Boolean(), server_default="true"),
    )

    op.create_table(
        "backups",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("type", sa.String(20)),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("size", sa.Integer(), server_default="0"),
        sa.Column("tables", sa.Text(), nullable=True),
        sa.Column("data", sa.Text(), nullable=True),
        sa.Column("filename", sa.String(200), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("backups")
    op.drop_table("user_permissions")
    op.drop_table("users")
    op.drop_table("settings")
    op.drop_table("measurements")
    op.drop_table("inventory")
    op.drop_table("purchase_items")
    op.drop_table("purchases")
    op.drop_table("expenses")
    op.drop_table("payments")
    op.drop_table("invoice_items")
    op.drop_table("invoices")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("quotation_items")
    op.drop_table("quotations")
    op.drop_table("suppliers")
    op.drop_table("products")
    op.drop_table("customers")
