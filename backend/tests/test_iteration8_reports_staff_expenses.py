"""Iteration 8 — /api/reports/staff and /api/reports/expenses new endpoints + regressions."""
import os
import uuid
import datetime as dt
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_MOBILE = "9999999999"
ADMIN_PASSWORD = "admin123"
ADMIN_PIN = "123456"
TODAY = dt.datetime.now(dt.timezone.utc).date().isoformat()


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Root sanity ----------
def test_root_ok():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"


# ---------- Empty-shape validations ----------
def test_staff_report_empty_shape_no_query():
    r = requests.get(f"{API}/reports/staff", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("date", "staff", "staff_count", "shift_count", "transaction_count"):
        assert k in d, f"missing {k}"
    assert isinstance(d["staff"], list)
    assert isinstance(d["staff_count"], int)


def test_staff_report_far_past_zero():
    r = requests.get(f"{API}/reports/staff", params={"day": "2020-01-01"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["date"] == "2020-01-01"
    assert d["staff_count"] == 0
    assert d["shift_count"] == 0
    assert d["transaction_count"] == 0
    assert d["staff"] == []


def test_expenses_report_empty_shape_no_query():
    r = requests.get(f"{API}/reports/expenses", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("date", "transaction_count", "total", "by_category", "by_method", "by_staff", "transactions"):
        assert k in d, f"missing {k}"
    assert isinstance(d["by_category"], list)
    assert isinstance(d["by_staff"], list)
    assert isinstance(d["by_method"], dict)
    for m in ("CASH", "UPI", "BANK"):
        assert m in d["by_method"]


def test_expenses_report_far_past_zero():
    r = requests.get(f"{API}/reports/expenses", params={"day": "2020-01-01"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["transaction_count"] == 0
    assert d["total"] == 0


# ---------- Populated flow ----------
@pytest.fixture(scope="module")
def seeded_env(headers):
    """Ensure no open shift, open one with staff A, record two CASH txns + one OUT for expense report."""
    # Ensure no open shift; if there is, close it fast
    cur = requests.get(f"{API}/shifts/current", timeout=15).json()
    if cur.get("shift"):
        # close using any staff
        staff = requests.get(f"{API}/staff", timeout=15).json()
        sid = staff[0]["id"]
        requests.post(f"{API}/shifts/close", json={
            "staff_id": sid,
            "denominations": {"d500": 0, "d200": 0, "d100": 0, "d50": 0, "d20": 0, "d10": 0, "d5": 0, "d2": 0, "d1": 0},
        }, timeout=15)

    staff = requests.get(f"{API}/staff", timeout=15).json()
    assert len(staff) >= 1
    staff_a = staff[0]
    # Open with 100 (a single d100)
    r = requests.post(f"{API}/shifts/open", json={
        "staff_id": staff_a["id"],
        "denominations": {"d500": 0, "d200": 0, "d100": 1, "d50": 0, "d20": 0, "d10": 0, "d5": 0, "d2": 0, "d1": 0},
    }, timeout=15)
    assert r.status_code == 200, r.text
    shift = r.json()

    # CASH IN 100
    t1 = requests.post(f"{API}/transactions", json={
        "type": "IN", "category": "TEST_CashSale", "amount": 100,
        "staff_id": staff_a["id"], "payment_method": "CASH",
        "client_id": f"TEST_it8_in_{uuid.uuid4().hex[:8]}",
    }, timeout=15)
    assert t1.status_code == 200, t1.text

    # UPI IN 200 if bank exists, else another CASH IN
    banks = requests.get(f"{API}/banks", timeout=15).json()
    if banks:
        t2 = requests.post(f"{API}/transactions", json={
            "type": "IN", "category": "TEST_UPISale", "amount": 200,
            "staff_id": staff_a["id"], "payment_method": "UPI",
            "bank_id": banks[0]["id"],
            "client_id": f"TEST_it8_upi_{uuid.uuid4().hex[:8]}",
        }, timeout=15)
        upi_ok = t2.status_code == 200
    else:
        t2 = requests.post(f"{API}/transactions", json={
            "type": "IN", "category": "TEST_CashSale2", "amount": 200,
            "staff_id": staff_a["id"], "payment_method": "CASH",
            "client_id": f"TEST_it8_cash2_{uuid.uuid4().hex[:8]}",
        }, timeout=15)
        upi_ok = False
        assert t2.status_code == 200, t2.text

    # OUT 50 CASH — for expenses report
    t3 = requests.post(f"{API}/transactions", json={
        "type": "OUT", "category": "TEST_Expense", "amount": 50,
        "staff_id": staff_a["id"], "payment_method": "CASH",
        "client_id": f"TEST_it8_out_{uuid.uuid4().hex[:8]}",
    }, timeout=15)
    assert t3.status_code == 200, t3.text

    yield {"staff": staff_a, "shift": shift, "has_upi": upi_ok}

    # Teardown: close shift
    requests.post(f"{API}/shifts/close", json={
        "staff_id": staff_a["id"],
        "denominations": {"d500": 0, "d200": 0, "d100": 1, "d50": 1, "d20": 0, "d10": 0, "d5": 0, "d2": 0, "d1": 0},
    }, timeout=15)


def test_staff_report_populated(seeded_env):
    r = requests.get(f"{API}/reports/staff", params={"day": TODAY}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["date"] == TODAY
    assert d["staff_count"] >= 1
    staff_id = seeded_env["staff"]["id"]
    row = next((x for x in d["staff"] if x["staff_id"] == staff_id), None)
    assert row is not None, f"seeded staff not present. staff rows={d['staff']}"
    assert row["shifts_opened"] >= 1
    assert row["transaction_count"] >= 2  # at least CASH IN + one more
    # Totals.IN should include at least 100 + 200 = 300 (whether UPI or CASH)
    assert row["totals"]["IN"] >= 300
    assert row["totals"]["OUT"] >= 50
    # by_method contains all three keys with types
    for m in ("CASH", "UPI", "BANK"):
        assert m in row["by_method"]
        for t in ("IN", "OUT", "ADJUSTMENT"):
            assert t in row["by_method"][m]
    # CASH IN captured
    assert row["by_method"]["CASH"]["IN"] >= 100
    assert row["by_method"]["CASH"]["OUT"] >= 50
    if seeded_env["has_upi"]:
        assert row["by_method"]["UPI"]["IN"] >= 200


def test_expenses_report_populated(seeded_env):
    r = requests.get(f"{API}/reports/expenses", params={"day": TODAY}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["date"] == TODAY
    assert d["transaction_count"] >= 1
    assert d["total"] >= 50
    cat = next((c for c in d["by_category"] if c["category"] == "TEST_Expense"), None)
    assert cat is not None, f"TEST_Expense category not found. by_category={d['by_category']}"
    assert cat["amount"] >= 50
    assert d["by_method"]["CASH"] >= 50
    staff_id = seeded_env["staff"]["id"]
    srow = next((s for s in d["by_staff"] if s["staff_id"] == staff_id), None)
    assert srow is not None
    assert srow["amount"] >= 50
    assert srow["count"] >= 1


# ---------- Regressions ----------
def test_daily_report_shape():
    r = requests.get(f"{API}/reports/daily", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("date", "shift_count", "transaction_count", "totals", "totals_by_method", "shifts", "transactions"):
        assert k in d
    for t in ("IN", "OUT", "ADJUSTMENT"):
        assert t in d["totals"]
    for m in ("CASH", "UPI", "BANK"):
        assert m in d["totals_by_method"]


def test_admin_dashboard_401_without_token():
    r = requests.get(f"{API}/admin/dashboard", timeout=10)
    assert r.status_code == 401


def test_staff_post_401_without_token():
    r = requests.post(f"{API}/staff", json={"name": "TEST_NoAuth", "role": "Cashier"}, timeout=10)
    assert r.status_code == 401
