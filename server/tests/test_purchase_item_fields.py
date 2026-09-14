from models.purchase import PurchaseItem


def test_purchase_item_has_color_size_gaze_columns():
    columns = {column.name for column in PurchaseItem.__table__.columns}
    assert {"color", "size", "gaze"}.issubset(columns)
