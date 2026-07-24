"""
SELTRACK Backend API Tests
Covers: root, staff, shifts, transactions, reports (X/Z/daily), meta,
receipt sequencing, denomination math, and error cases.

IMPORTANT: Run serially. The TestShiftFlow class shares mutable DB state (the
single open shift) across tests. pytest-xdist parallel workers cause the
session-scoped teardown of one worker to close the shift mid-flow of another.

Run with:
    pytest backend/tests/test_seltrack_backend.py -v -n 0
"""
import os
import re
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cash-pulse-16.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# ---------- Helpers ----------
def denom(**kw):
    d = {"d500": 0, "d200": 0, "d100": 0, "d50": 0, "d20": 0, "d10": 0, "d5": 0, "d2": 0, "d1": 0}
    d.update(kw)
    return d


def _close_any_open_shift(staff_id):
    """Cleanup: close any lingering open shift so tests start fresh."""
    r = requests.get(f"{API}/shifts/current", timeout=15)
    if r.status_code == 200 and r.json().get("shift"):
        # match expected balance so variance=0 is not required; using zero denom is fine
        requests.post(
            f"{API}/shifts/close",
            json={"staff_id": staff_id, "denominations": denom(), "note": "cleanup"},
            timeout=15,
        )


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def staff_list(session_client):
    r = session_client.get(f"{API}/staff", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    return data


@pytest.fixture(scope="session")
def primary_staff_id(staff_list):
    # ensure at least one staff exists
    assert len(staff_list) >= 1
    # Prefer Rahul Sharma if present
    for s in staff_list:
        if s["name"] == "Rahul Sharma":
            return s["id"]
    return staff_list[0]["id"]


@pytest.fixture(scope="session", autouse=True)
def _fresh_state(primary_staff_id):
    """Before running any tests, close any open shift to start fresh."""
    _close_any_open_shift(primary_staff_id)
    yield
    # Teardown: attempt to close leftover shifts
    _close_any_open_shift(primary_staff_id)


# ---------- Root ----------
class TestRoot:
    def test_root_returns_seltrack_status(self, session_client):
        r = session_client.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["app"] == "SELTRACK"
        assert body["status"] == "ok"
        assert "time" in body
        # ISO parseable
        datetime.fromisoformat(body["time"])


# ---------- Staff ----------
class TestStaff:
    def test_staff_seeded_defaults(self, session_client):
        r = session_client.get(f"{API}/staff", timeout=15)
        assert r.status_code == 200
        names = {s["name"] for s in r.json()}
        for expected in ["Rahul Sharma", "Priya Patel", "Amit Kumar", "Sneha Iyer"]:
            assert expected in names, f"Missing default staff: {expected}"

    def test_staff_have_required_fields(self, staff_list):
        for s in staff_list:
            assert "id" in s and isinstance(s["id"], str)
            assert "name" in s
            assert "role" in s
            assert s.get("active", True) is True

    def test_create_staff(self, session_client):
        payload = {"name": "TEST_Extra Cashier", "role": "Cashier"}
        r = session_client.post(f"{API}/staff", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["role"] == "Cashier"
        assert data["active"] is True
        assert isinstance(data["id"], str) and len(data["id"]) > 0

        # verify via GET list
        r2 = session_client.get(f"{API}/staff", timeout=15)
        names = {s["name"] for s in r2.json()}
        assert "TEST_Extra Cashier" in names


# ---------- Meta ----------
class TestMeta:
    def test_denominations_endpoint(self, session_client):
        r = session_client.get(f"{API}/meta/denominations", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["currency"] == "INR"
        assert data["denominations"] == [500, 200, 100, 50, 20, 10, 5, 2, 1]


# ---------- Full shift + transactions + reports flow (ordered) ----------
class TestShiftFlow:
    # class-scoped state
    state = {}

    def test_01_current_shift_none(self, session_client):
        r = session_client.get(f"{API}/shifts/current", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["shift"] is None
        assert body["balance"] == 0.0
        assert body["totals"] == {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}

    def test_02_open_shift_with_denominations(self, session_client, primary_staff_id):
        payload = {
            "staff_id": primary_staff_id,
            "denominations": denom(d500=2, d100=5, d50=4, d10=5, d1=10),
            "note": "opening",
        }
        # Expected total: 2*500 + 5*100 + 4*50 + 5*10 + 10*1 = 1000+500+200+50+10 = 1760
        r = session_client.post(f"{API}/shifts/open", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "OPEN"
        assert data["opening_amount"] == 1760.0
        assert data["opened_by_id"] == primary_staff_id
        assert data["opened_by_name"]
        # ISO parseable
        datetime.fromisoformat(data["opened_at"])
        TestShiftFlow.state["shift_id"] = data["id"]

    def test_03_open_second_shift_fails(self, session_client, primary_staff_id):
        r = session_client.post(
            f"{API}/shifts/open",
            json={"staff_id": primary_staff_id, "denominations": denom(d100=1)},
            timeout=15,
        )
        assert r.status_code == 400
        assert "already open" in r.text.lower()

    def test_04_txn_in_cash_sale(self, session_client, primary_staff_id):
        r = session_client.post(
            f"{API}/transactions",
            json={"type": "IN", "category": "Cash Sale", "amount": 500, "staff_id": primary_staff_id},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["type"] == "IN"
        assert data["category"] == "Cash Sale"
        assert data["amount"] == 500
        assert data["shift_id"] == TestShiftFlow.state["shift_id"]
        assert isinstance(data["receipt_number"], int) and data["receipt_number"] > 0
        TestShiftFlow.state["r1"] = data["receipt_number"]

    def test_05_txn_out_expense(self, session_client, primary_staff_id):
        r = session_client.post(
            f"{API}/transactions",
            json={"type": "OUT", "category": "Expense", "amount": 200, "staff_id": primary_staff_id},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["type"] == "OUT"
        assert data["amount"] == 200
        assert data["receipt_number"] > TestShiftFlow.state["r1"]
        TestShiftFlow.state["r2"] = data["receipt_number"]

    def test_06_txn_adjustment_negative_allowed(self, session_client, primary_staff_id):
        r = session_client.post(
            f"{API}/transactions",
            json={"type": "ADJUSTMENT", "category": "Cash Missing", "amount": -50, "staff_id": primary_staff_id},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["type"] == "ADJUSTMENT"
        assert data["amount"] == -50
        assert data["receipt_number"] > TestShiftFlow.state["r2"]

    def test_07_txn_in_with_zero_amount_rejected(self, session_client, primary_staff_id):
        r = session_client.post(
            f"{API}/transactions",
            json={"type": "IN", "category": "Cash Sale", "amount": 0, "staff_id": primary_staff_id},
            timeout=15,
        )
        assert r.status_code == 400
        assert "positive" in r.text.lower()

    def test_08_txn_in_with_negative_amount_rejected(self, session_client, primary_staff_id):
        r = session_client.post(
            f"{API}/transactions",
            json={"type": "IN", "category": "Cash Sale", "amount": -100, "staff_id": primary_staff_id},
            timeout=15,
        )
        assert r.status_code == 400

    def test_09_list_transactions_current_shift(self, session_client):
        r = session_client.get(f"{API}/transactions", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 3
        shift_id = TestShiftFlow.state["shift_id"]
        for t in data:
            assert t["shift_id"] == shift_id

    def test_10_current_shift_balance_and_totals(self, session_client):
        r = session_client.get(f"{API}/shifts/current", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["shift"] is not None
        # balance = 1760 + 500 - 200 + (-50) = 2010
        assert data["balance"] == 2010.0
        assert data["totals"]["IN"] == 500.0
        assert data["totals"]["OUT"] == 200.0
        assert data["totals"]["ADJUSTMENT"] == -50.0

    def test_11_x_report_snapshot(self, session_client):
        r = session_client.get(f"{API}/reports/x", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["report_type"] == "X"
        assert data["shift"]["id"] == TestShiftFlow.state["shift_id"]
        assert data["totals"]["IN"] == 500.0
        assert data["totals"]["OUT"] == 200.0
        assert data["totals"]["ADJUSTMENT"] == -50.0
        assert data["transaction_count"] >= 3
        assert data["expected_amount"] == 2010.0
        # by_category has type:category keys
        assert any(k.startswith("IN:") for k in data["by_category"].keys())
        assert isinstance(data["transactions"], list)

    def test_12_z_report_on_open_shift_returns_400(self, session_client):
        shift_id = TestShiftFlow.state["shift_id"]
        r = session_client.get(f"{API}/reports/z", params={"shift_id": shift_id}, timeout=15)
        assert r.status_code == 400
        assert "closed" in r.text.lower()

    def test_13_close_shift_zero_variance(self, session_client, primary_staff_id):
        # 4*500 + 1*10 = 2010
        payload = {
            "staff_id": primary_staff_id,
            "denominations": denom(d500=4, d10=1),
            "note": "closing",
        }
        r = session_client.post(f"{API}/shifts/close", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "CLOSED"
        assert data["expected_amount"] == 2010.0
        assert data["closing_amount"] == 2010.0
        assert data["variance"] == 0.0
        assert data["closed_by_id"] == primary_staff_id
        datetime.fromisoformat(data["closed_at"])

    def test_14_z_report_on_closed_shift(self, session_client):
        shift_id = TestShiftFlow.state["shift_id"]
        r = session_client.get(f"{API}/reports/z", params={"shift_id": shift_id}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["report_type"] == "Z"
        assert data["shift"]["id"] == shift_id
        assert data["shift"]["status"] == "CLOSED"
        assert data["transaction_count"] >= 3

    def test_15_transactions_when_no_open_shift_rejected(self, session_client, primary_staff_id):
        # after close, no shift open -> POST /transactions must 400
        cur = session_client.get(f"{API}/shifts/current", timeout=15).json()
        assert cur["shift"] is None
        r = session_client.post(
            f"{API}/transactions",
            json={"type": "IN", "category": "Cash Sale", "amount": 100, "staff_id": primary_staff_id},
            timeout=15,
        )
        assert r.status_code == 400
        assert "no open shift" in r.text.lower()

    def test_16_list_shifts_sorted_newest_first(self, session_client):
        r = session_client.get(f"{API}/shifts", timeout=15)
        assert r.status_code == 200
        shifts = r.json()
        assert isinstance(shifts, list) and len(shifts) >= 1
        # sorted desc by opened_at
        opened = [s["opened_at"] for s in shifts]
        assert opened == sorted(opened, reverse=True)

    def test_17_get_shift_by_id(self, session_client):
        shift_id = TestShiftFlow.state["shift_id"]
        r = session_client.get(f"{API}/shifts/{shift_id}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["shift"]["id"] == shift_id
        assert isinstance(data["transactions"], list) and len(data["transactions"]) >= 3
        assert "expected" in data
        # For closed shift with variance 0, expected should equal 2010
        assert data["expected"] == 2010.0

    def test_18_daily_report(self, session_client):
        r = session_client.get(f"{API}/reports/daily", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "date" in data
        assert data["shift_count"] >= 1
        assert data["transaction_count"] >= 3
        assert set(data["totals"].keys()) == {"IN", "OUT", "ADJUSTMENT"}

    def test_19_receipt_numbers_monotonic(self, session_client, primary_staff_id):
        # open a fresh shift, add 2 txns, verify receipt numbers strictly increase (and > last)
        r = session_client.post(
            f"{API}/shifts/open",
            json={"staff_id": primary_staff_id, "denominations": denom(d100=1)},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        prev = TestShiftFlow.state.get("r2", 0)
        r1 = session_client.post(
            f"{API}/transactions",
            json={"type": "IN", "category": "Cash Sale", "amount": 10, "staff_id": primary_staff_id},
            timeout=15,
        ).json()
        r2 = session_client.post(
            f"{API}/transactions",
            json={"type": "IN", "category": "Cash Sale", "amount": 20, "staff_id": primary_staff_id},
            timeout=15,
        ).json()
        assert r2["receipt_number"] > r1["receipt_number"] > prev
        # cleanup: close this shift
        session_client.post(
            f"{API}/shifts/close",
            json={"staff_id": primary_staff_id, "denominations": denom(d100=1, d10=3)},
            timeout=15,
        )

    def test_20_iso_datetime_format(self, session_client):
        # verify a listed shift has ISO-parseable opened_at (and closed_at when set)
        r = session_client.get(f"{API}/shifts", timeout=15)
        shifts = r.json()
        for s in shifts[:5]:
            datetime.fromisoformat(s["opened_at"])
            if s.get("closed_at"):
                datetime.fromisoformat(s["closed_at"])
