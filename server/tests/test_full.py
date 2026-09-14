"""Full project test suite - uses urllib (no pip needed)."""
import urllib.request, urllib.error, json, time

BASE = "http://localhost:8000"
PASS = FAIL = 0
TESTS = []
TS = int(time.time()) % 100000  # unique prefix

BASE = "http://localhost:8000"
PASS = FAIL = 0
TESTS = []

def T(name, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        TESTS.append(f"  PASS: {name}")
    else:
        FAIL += 1
        TESTS.append(f"  FAIL: {name}" + (f" ({detail})" if detail else ""))

def req(method, path, data=None, headers=None):
    url = f"{BASE}{path}"
    h = {"Content-Type": "application/json"}
    if headers: h.update(headers)
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=5)
        raw = resp.read()
        try: detail = json.loads(raw)
        except: detail = raw.decode(errors="replace")
        return resp.status, detail
    except urllib.error.HTTPError as e:
        raw = e.read()
        try: detail = json.loads(raw)
        except: detail = raw.decode(errors="replace")
        return e.code, detail
    except Exception as e:
        return 599, str(e)

def login():
    code, body = req("POST", "/api/auth/login", {"username": "admin", "password": "lucky54321"})
    assert code == 200, f"Login failed: {code} {body}"
    return body["token"]

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def GET(h, path): return req("GET", path, headers=h)
def POST(h, path, data):
    code, body = req("POST", path, data, h)
    if code >= 400:
        print(f"    [DEBUG POST {path}] {code}: {json.dumps(body)[:200]}")
    return code, body

def PUT(h, path, data=None):
    code, body = req("PUT", path, data, h)
    if code >= 400:
        print(f"    [DEBUG PUT {path}] {code}: {json.dumps(body)[:200]}")
    return code, body

def DELETE(h, path):
    code, body = req("DELETE", path, headers=h)
    if code >= 400:
        print(f"    [DEBUG DELETE {path}] {code}: {json.dumps(body)[:200]}")
    return code, body
def PUT(h, path, data): return req("PUT", path, data, h)
def DELETE(h, path): return req("DELETE", path, headers=h)

# ============================================================
print("=" * 60)
print("  FULL PROJECT TEST SUITE")
print("=" * 60)

# --- AUTH ---
print("\n=== AUTH ===")
try:
    token = login()
    h = auth(token)
    T("Admin login", True)
    T("Token received", len(token) > 10)
    code, body = GET(h, "/api/auth/me")
    T("Auth /me", code == 200 and body.get("username") == "admin")
except Exception as e:
    T("Auth setup", False, str(e))
    print("FATAL: Cannot proceed without auth")
    exit(1)

# --- CUSTOMERS ---
print("\n=== CUSTOMERS ===")
code, cu = POST(h, "/api/customers", {"code": f"TC-{TS}", "name": "TestCust", "mobile": "555", "previousBalance": 1000})
T("Create customer", code == 200 and cu.get("id", 0) > 0)
cu_id = cu["id"]
T("Customer prevBal create", cu.get("previousBalance") == 1000)

code, cu_r = GET(h, f"/api/customers/{cu_id}")
T("Read customer prevBal", cu_r.get("previousBalance") == 1000)

code, cu_u = PUT(h, f"/api/customers/{cu_id}", {"id": cu_id, "code": f"TC-{TS}", "name": "TestCust", "mobile": "666", "previousBalance": 2000})
T("Update customer prevBal", cu_u.get("previousBalance") == 2000)

code, cu_r2 = GET(h, f"/api/customers/{cu_id}")
T("Persist prevBal after update", cu_r2.get("previousBalance") == 2000)

c, _ = POST(h, "/api/customers", {"code": f"TC-{TS}", "name": "Dup", "mobile": "1"})
T("Reject duplicate code", c == 400)

c, _ = POST(h, "/api/customers", {})
T("Reject empty customer", c == 422)

c, _ = GET(h, "/api/customers/99999")
T("404 customer get", c == 404)

c, _ = DELETE(h, "/api/customers/99999")
T("404 customer delete", c == 404)

code, cu_list = GET(h, "/api/customers")
T("Customer list is array", code == 200 and isinstance(cu_list, list))

# --- PRODUCTS ---
print("\n=== PRODUCTS ===")
code, pr = POST(h, "/api/products", {"code": f"TP-{TS}", "name": f"TestProd-{TS}", "category": "Test", "unit": "pcs", "basePrice": 100, "color": "Silver", "size": "4x4", "gaze": "Double"})
T("Create product", code == 200 and pr.get("id", 0) > 0)
pr_id = pr["id"]
T("Product has color", pr.get("color") == "Silver")
T("Product has size", pr.get("size") == "4x4")
T("Product has gaze", pr.get("gaze") == "Double")

code, pr_u = PUT(h, f"/api/products/{pr_id}", {"id": pr_id, "code": f"TP-{TS}", "name": f"TestProd-{TS}", "category": "Test", "unit": "pcs", "basePrice": 200, "color": "Gold", "size": "6x6", "gaze": "Single"})
T("Update product", pr_u.get("basePrice") == 200 and pr_u.get("color") == "Gold")

code, pr_list = GET(h, "/api/products")
T("Product list is array", isinstance(pr_list, list))

# --- INVENTORY ---
print("\n=== INVENTORY ===")
code, inv = POST(h, "/api/inventory", {"name": f"TestInv-{TS}", "category": "Test", "unit": "pcs", "itemType": "window", "pricingMode": "piece", "currentStock": 50, "minStock": 10, "costPrice": 80, "color": "Silver", "size": "4x4", "gaze": "Double"})
T("Create inventory", code == 200 and inv.get("id", 0) > 0)
inv_id = inv["id"]
T("Inventory has color", inv.get("color") == "Silver")
T("Inventory has size", inv.get("size") == "4x4")
T("Inventory has gaze", inv.get("gaze") == "Double")

# Same name, different size
code, inv2 = POST(h, "/api/inventory", {"name": f"TestInv-{TS}", "category": "Test", "unit": "pcs", "itemType": "window", "pricingMode": "piece", "currentStock": 30, "minStock": 5, "costPrice": 90, "color": "Silver", "size": "6x6", "gaze": "Single"})
T("Create inventory (diff size)", code == 200 and inv2.get("id", 0) > 0)
inv2_id = inv2["id"]

code, inv_list = GET(h, "/api/inventory")
same_name = [i for i in inv_list if i["name"] == f"TestInv-{TS}"]
T("Multiple inv same name", len(same_name) >= 2)
T("Inventory list is array", isinstance(inv_list, list))

# --- SUPPLIERS ---
print("\n=== SUPPLIERS ===")
code, sup = POST(h, "/api/suppliers", {"name": f"TestSupp-{TS}", "contact": "777", "mobile": "777"})
T("Create supplier", code == 200 and sup.get("id", 0) > 0)
sup_id = sup["id"]

code, sup_list = GET(h, "/api/suppliers")
T("Supplier list is array", isinstance(sup_list, list))

# --- PURCHASES ---
print("\n=== PURCHASES ===")
code, pu = POST(h, "/api/purchases", {
    "invoiceNumber": f"INV-{TS}", "supplierId": sup_id, "supplierName": f"TestSupp-{TS}",
    "paymentType": "credit", "totalAmount": 3000,
    "date": "2026-09-14T00:00:00",
    "items": [{"productName": f"TestInv-{TS}", "color": "Silver", "size": "4x4", "gaze": "Double", "itemType": "window", "pricingMode": "piece", "quantity": 20, "purchasePrice": 150, "salePrice": 250, "amount": 3000}]
})
T("Create purchase", code == 200 and pu.get("id", 0) > 0)
pu_id = pu["id"]
T("Purchase totalAmount", pu.get("totalAmount") == 3000)

# Check purchase items have color/size/gaze
code, pu_list = GET(h, "/api/purchases")
pu_match = [p for p in pu_list if p["id"] == pu_id]
if pu_match and pu_match[0]["items"]:
    item = pu_match[0]["items"][0]
    T("Purchase item color", item.get("color") == "Silver")
    T("Purchase item size", item.get("size") == "4x4")
    T("Purchase item gaze", item.get("gaze") == "Double")
else:
    T("Purchase item color", False, "no items")
T("Purchase list is array", isinstance(pu_list, list))

# --- QUOTATIONS ---
print("\n=== QUOTATIONS ===")
code, qt = POST(h, "/api/quotations", {
    "number": f"QT-{TS}", "customerId": cu_id, "customerName": "TestCust",
    "date": "2026-09-14T00:00:00", "subtotal": 1000, "discountPercent": 10,
    "extraCharges": 200, "total": 1100, "status": "draft",
    "items": [{"productName": f"TestProd-{TS}", "color": "Silver", "size": "4x4", "gaze": "Double", "itemType": "window", "quantity": 2, "unitPrice": 500, "amount": 1000}]
})
T("Create quotation", code == 200 and qt.get("id", 0) > 0)
qt_id = qt["id"]
T("Quot discountPercent", qt.get("discountPercent") == 10)
T("Quot extraCharges", qt.get("extraCharges") == 200)
T("Quot total", qt.get("total", 0) > 0)

# Check quotation items have color/size/gaze
code, qt_list = GET(h, "/api/quotations")
qt_match = [q for q in qt_list if q["id"] == qt_id]
if qt_match and qt_match[0]["items"]:
    qi = qt_match[0]["items"][0]
    T("Quot item color", qi.get("color") == "Silver")
    T("Quot item size", qi.get("size") == "4x4")
else:
    T("Quot item color", False, "no items")

# Update quotation status
code, qt_u = PUT(h, f"/api/quotations/{qt_id}", {
    "id": qt_id, "number": f"QT-{TS}", "customerId": cu_id, "customerName": "TestCust",
    "date": "2026-09-14T00:00:00", "subtotal": 1000, "discountPercent": 10,
    "extraCharges": 200, "total": 1100, "status": "approved",
    "items": [{"productName": f"TestProd-{TS}", "color": "Silver", "size": "4x4", "gaze": "Double", "itemType": "window", "quantity": 2, "unitPrice": 500, "amount": 1000}]
})
T("Quotation status update", qt_u.get("status") == "approved")

# Reject >100% discount
c, _ = POST(h, "/api/quotations", {"number": f"QT-BAD-{TS}", "customerId": cu_id, "customerName": "X", "date": "2026-09-14T00:00:00", "subtotal": 100, "discountPercent": 150, "total": 100, "items": [{"productName": "X", "quantity": 1, "unitPrice": 100, "amount": 100}]})
T("Reject 150% discount", c == 422)

# Delete quotation
c, _ = DELETE(h, f"/api/quotations/{qt_id}")
T("Delete quotation", c == 200)
T("Quotation list is array", isinstance(qt_list, list))

# --- ORDERS ---
print("\n=== ORDERS ===")
code, o = POST(h, "/api/orders", {
    "number": f"ORD-{TS}", "customerId": cu_id, "customerName": "TestCust",
    "orderDate": "2026-09-14T00:00:00", "subtotal": 2000, "discountPercent": 5,
    "extraCharges": 500, "total": 2400, "status": "pending",
    "items": [{"productName": f"TestProd-{TS}", "color": "Gold", "size": "6x6", "gaze": "Single", "itemType": "window", "width": 4, "height": 5, "quantity": 2, "unitPrice": 200, "amount": 400}]
})
T("Create order", code == 200 and o.get("id", 0) > 0)
o_id = o["id"]
T("Order discountPercent", o.get("discountPercent") == 5)
T("Order extraCharges", o.get("extraCharges") == 500)

# Check order items have color/size/gaze
code, o_list = GET(h, "/api/orders")
o_match = [x for x in o_list if x["id"] == o_id]
if o_match and o_match[0]["items"]:
    oi = o_match[0]["items"][0]
    T("Order item color", oi.get("color") == "Gold")
    T("Order item size", oi.get("size") == "6x6")
    T("Order item gaze", oi.get("gaze") == "Single")
else:
    T("Order item color", False, "no items")

# Status transitions
c, b = PUT(h, f"/api/orders/{o_id}/status?status=confirmed", None)
T("Order status->confirmed", c == 200 and b.get("success") == True)

c, b = PUT(h, f"/api/orders/{o_id}/status?status=in_production", None)
T("Order status->in_production", c == 200)

c, b = PUT(h, f"/api/orders/{o_id}/status?status=finished", None)
T("Order status->finished", c == 200)

c, _ = PUT(h, f"/api/orders/{o_id}/status?status=bogus", None)
T("Invalid status rejected", c == 400)
T("Order list is array", isinstance(o_list, list))

# --- PAYMENTS ---
print("\n=== PAYMENTS ===")
code, pay = POST(h, "/api/payments", {"customerId": cu_id, "amount": 500, "method": "cash", "type": "receive", "date": "2026-09-14T00:00:00", "note": "Test"})
T("Create payment", code == 200 and pay.get("id", 0) > 0)
T("Payment amount", pay.get("amount") == 500)

# Overpayment check
c, _ = POST(h, "/api/payments", {"orderId": o_id, "customerId": cu_id, "amount": 999999, "method": "cash", "type": "receive", "date": "2026-09-14T00:00:00"})
T("Overpayment rejected", c == 400)

code, pay_list = GET(h, "/api/payments")
T("Payment list is array", isinstance(pay_list, list))

# --- INVOICES ---
print("\n=== INVOICES ===")
code, inv_list2 = GET(h, "/api/invoices")
T("Invoice list is array", isinstance(inv_list2, list))

# --- EXPENSES ---
print("\n=== EXPENSES ===")
code, exp = POST(h, "/api/expenses", {"category": "Test", "amount": 150, "date": "2026-09-14T00:00:00", "description": "Test"})
T("Create expense", code == 200 and exp.get("id", 0) > 0)
exp_id = exp["id"]
T("Expense amount", exp.get("amount") == 150)

c, _ = DELETE(h, f"/api/expenses/{exp_id}")
T("Delete expense", c == 200)

c, _ = POST(h, "/api/expenses", {"category": "T", "amount": -1, "date": "2026-09-14T00:00:00"})
T("Reject negative amount", c == 422)

code, exp_list = GET(h, "/api/expenses")
T("Expense list is array", isinstance(exp_list, list))

# --- REPORTS ---
print("\n=== REPORTS ===")
for rp in ["/api/reports/dashboard", "/api/reports/sales", "/api/reports/expenses", "/api/reports/profit", "/api/reports/stock"]:
    c, _ = GET(h, rp)
    T(f"GET {rp}", c == 200)

# --- SETTINGS ---
print("\n=== SETTINGS ===")
code, st = GET(h, "/api/settings")
T("Settings list is array", isinstance(st, list))
T("Settings has items", len(st) >= 1)

for s in st:
    if s["key"] == "company_name":
        orig = s["value"]
        code, su = PUT(h, f"/api/settings/{s['id']}", {"id": s["id"], "key": "company_name", "value": "TestCo"})
        T("Setting update", su.get("value") == "TestCo")
        PUT(h, f"/api/settings/{s['id']}", {"id": s["id"], "key": "company_name", "value": orig})
        break

# --- USERS / ACCESS CONTROL ---
print("\n=== USERS ===")
code, nu = POST(h, "/api/users", {"fullName": "TestUser", "username": f"toper{TS}", "email": "t@t.com", "phone": "123", "password": "Test123456", "role": "manager"})
T("Create user", code == 200 and nu.get("id", 0) > 0)
nu_id = nu["id"]
T("User role forced to manager", nu.get("role") == "manager")

c, body = req("POST", "/api/auth/login", {"username": f"toper{TS}", "password": "Test123456"})
T("Manager login", c == 200)
if c == 200:
    ot = body["token"]
    T("Manager token valid", len(ot) > 10)

c, _ = DELETE(h, f"/api/users/{nu_id}")
T("Delete user", c == 200)

# --- PERMISSIONS ---
print("\n=== PERMISSIONS ===")
code, perm = GET(h, "/api/permissions/user/1")
T("Permissions is array", isinstance(perm, list))
T("Admin has permissions", len(perm) > 0)

# --- MEASUREMENTS ---
print("\n=== MEASUREMENTS ===")
code, meas = GET(h, "/api/measurements")
T("Measurements is array", isinstance(meas, list))

# --- BACKUP ---
print("\n=== BACKUP ===")
code, bak = GET(h, "/api/backup/snapshots")
T("Backup is array", isinstance(bak, list))

# --- ALL ENDPOINTS ARRAY CHECK ---
print("\n=== ALL ENDPOINTS ARRAY CHECK ===")
array_eps = ["/api/customers", "/api/orders", "/api/expenses", "/api/inventory", "/api/products",
             "/api/quotations", "/api/invoices", "/api/payments", "/api/suppliers", "/api/purchases",
             "/api/measurements", "/api/settings", "/api/permissions/user/1"]
for ep in array_eps:
    c, body = GET(h, ep)
    T(f"GET {ep} is array", isinstance(body, list))

# --- CLEANUP ---
print("\n=== CLEANUP ===")
c, _ = DELETE(h, f"/api/orders/{o_id}"); print(f"  Delete order: {c}")
c, _ = DELETE(h, f"/api/purchases/{pu_id}"); print(f"  Delete purchase: {c}")
c, _ = DELETE(h, f"/api/inventory/{inv_id}"); print(f"  Delete inventory 1: {c}")
c, _ = DELETE(h, f"/api/inventory/{inv2_id}"); print(f"  Delete inventory 2: {c}")
c, _ = DELETE(h, f"/api/products/{pr_id}"); print(f"  Delete product: {c}")
c, _ = DELETE(h, f"/api/suppliers/{sup_id}"); print(f"  Delete supplier: {c}")
c, _ = DELETE(h, f"/api/customers/{cu_id}"); print(f"  Delete customer: {c}")

# ============================================================
print("\n" + "=" * 60)
for t in TESTS:
    print(t)
print(f"\n  RESULTS: {PASS} passed, {FAIL} failed out of {PASS+FAIL} tests")
print("=" * 60)
