"""
SELTRACK — Iteration 5 fixes regression tests

Covers:
- Fix #1: /api/transactions returns [] when no open shift; only current-shift txns when open;
  explicit shift_id filter still returns closed-shift txns.
- Fix #3: idempotency via client_id (same client_id → same txn), unique client_id → new txn,
  omitted client_id → new txn each time. Bank balance changes exactly once per unique client_id.
- Fix #2 sanity: /api/admin/dashboard 401 without/with invalid token.
- Root health.

Serial execution required (shared shift state).
    pytest backend/tests/test_iteration5_fixes.py -v -n 0
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_MOBILE = "9999999999"
ADMIN_PASSWORD = "admin123"


def denom(**kw):
    d = {"d500": 0, "d200": 0, "d100": 0, "d50": 0, "d20": 0, "d10": 0, "d5": 0, "d2": 0, "d1": 0}
    d.update(kw)
    return d


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def token(s):
    r = s.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def staff_id(s):
    r = s.get(f"{API}/staff", timeout=15)
    assert r.status_code == 200
    return r.json()[0]["id"]


def close_open_shift(s, staff_id):
    cur = s.get(f"{API}/shifts/current", timeout=15).json()
    if cur.get("shift"):
        s.post(f"{API}/shifts/close",
               json={"staff_id": staff_id, "denominations": denom(), "note": "cleanup"}, timeout=15)


def open_shift(s, staff_id):
    op = s.post(f"{API}/shifts/open",
                json={"staff_id": staff_id, "denominations": denom(d500=6)}, timeout=15)
    assert op.status_code == 200, op.text
    return op.json()


# ============================================================
# Sanity
# ============================================================
class TestRootAndAuth:
    def test_root_ok(self, s):
        r = s.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_admin_dashboard_no_token_401(self, s):
        r = s.get(f"{API}/admin/dashboard", timeout=15)
        assert r.status_code == 401

    def test_admin_dashboard_invalid_token_401(self, s):
        r = s.get(f"{API}/admin/dashboard",
                  headers={"Authorization": "Bearer garbage-invalid-token"}, timeout=15)
        assert r.status_code == 401


# ============================================================
# Fix #1 — /api/transactions no-leak behavior
# ============================================================
class TestTransactionsNoLeak:
    """Ensure GET /api/transactions returns [] with no open shift, and only
    current-shift txns when open; historical txns must not leak."""

    def test_1_no_open_shift_returns_empty(self, s, staff_id):
        # Ensure DB has any prior open shift closed
        close_open_shift(s, staff_id)
        # Sanity: no open shift now
        cur = s.get(f"{API}/shifts/current", timeout=15).json()
        assert cur.get("shift") is None
        r = s.get(f"{API}/transactions", timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_2_open_shift_shows_only_current(self, s, staff_id):
        # Open a fresh shift
        shift = open_shift(s, staff_id)
        TestTransactionsNoLeak._shift_id = shift["id"]
        # Initially: no txns yet in this shift
        r = s.get(f"{API}/transactions", timeout=15)
        assert r.status_code == 200
        assert r.json() == []
        # Record a txn
        cid = str(uuid.uuid4())
        tr = s.post(f"{API}/transactions", json={
            "type": "IN", "category": "Cash Sale", "amount": 111,
            "staff_id": staff_id, "payment_method": "CASH", "client_id": cid,
        }, timeout=15)
        assert tr.status_code == 200, tr.text
        TestTransactionsNoLeak._txn_id = tr.json()["id"]
        # GET /transactions → 1 result, current shift only
        r2 = s.get(f"{API}/transactions", timeout=15)
        assert r2.status_code == 200
        arr = r2.json()
        assert len(arr) == 1
        assert arr[0]["id"] == TestTransactionsNoLeak._txn_id
        assert arr[0]["shift_id"] == shift["id"]

    def test_3_close_shift_returns_empty_again(self, s, staff_id):
        close_open_shift(s, staff_id)
        cur = s.get(f"{API}/shifts/current", timeout=15).json()
        assert cur.get("shift") is None
        r = s.get(f"{API}/transactions", timeout=15)
        assert r.status_code == 200
        assert r.json() == [], "Historical txns leaked when no shift open!"

    def test_4_explicit_shift_id_still_works(self, s):
        # Explicit shift_id filter should still return closed-shift txns
        r = s.get(f"{API}/transactions", params={"shift_id": TestTransactionsNoLeak._shift_id}, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert any(t["id"] == TestTransactionsNoLeak._txn_id for t in arr), \
            "Explicit shift_id filter should still return historical txns"


# ============================================================
# Fix #3 — Idempotency on client_id
# ============================================================
class TestIdempotency:
    """Test that POST /api/transactions with same client_id is idempotent, and
    bank balance changes exactly once."""

    @classmethod
    def _ensure_bank(cls, s, auth_headers, name, opening=10000):
        r = s.post(f"{API}/banks", headers=auth_headers,
                   json={"name": name, "opening_balance": opening}, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_1_setup_shift_and_bank(self, s, staff_id, auth_headers):
        close_open_shift(s, staff_id)
        # need an open shift for POST /transactions
        shift = open_shift(s, staff_id)
        TestIdempotency._shift = shift
        # Fresh bank
        bank = self._ensure_bank(s, auth_headers, f"TEST_Idem_{uuid.uuid4().hex[:6]}", 10000)
        TestIdempotency._bank_id = bank["id"]
        TestIdempotency._bank_opening = bank["current_balance"]
        assert TestIdempotency._bank_opening == 10000.0

    def test_2_same_client_id_returns_same_txn_cash(self, s, staff_id):
        cid = str(uuid.uuid4())
        body = {
            "type": "IN", "category": "Cash Sale", "amount": 250,
            "staff_id": staff_id, "payment_method": "CASH", "client_id": cid,
        }
        r1 = s.post(f"{API}/transactions", json=body, timeout=15)
        assert r1.status_code == 200, r1.text
        t1 = r1.json()
        # Second call with same client_id + same body
        r2 = s.post(f"{API}/transactions", json=body, timeout=15)
        assert r2.status_code == 200, r2.text
        t2 = r2.json()
        assert t1["id"] == t2["id"], "Idempotency broken: different txn ids"
        assert t1["receipt_number"] == t2["receipt_number"], "Idempotency: receipt_number should match"
        assert t1["client_id"] == cid

    def test_3_upi_dup_only_increments_bank_once(self, s, staff_id):
        # Get current bank balance before
        pre = next(b for b in s.get(f"{API}/banks", timeout=15).json() if b["id"] == TestIdempotency._bank_id)
        pre_bal = pre["current_balance"]
        cid = str(uuid.uuid4())
        body = {
            "type": "IN", "category": "UPI Sale", "amount": 500,
            "staff_id": staff_id, "payment_method": "UPI",
            "bank_id": TestIdempotency._bank_id, "client_id": cid,
        }
        r1 = s.post(f"{API}/transactions", json=body, timeout=15)
        assert r1.status_code == 200, r1.text
        t1 = r1.json()
        # duplicate submit
        r2 = s.post(f"{API}/transactions", json=body, timeout=15)
        assert r2.status_code == 200, r2.text
        t2 = r2.json()
        assert t1["id"] == t2["id"], "Duplicate UPI post created new txn"

        # Bank should have incremented ONCE only (+500)
        post = next(b for b in s.get(f"{API}/banks", timeout=15).json() if b["id"] == TestIdempotency._bank_id)
        assert post["current_balance"] == pre_bal + 500.0, \
            f"Bank balance mismatch: expected {pre_bal + 500}, got {post['current_balance']}"

        # Third and fourth submit with same client_id — still no bank change
        r3 = s.post(f"{API}/transactions", json=body, timeout=15)
        r4 = s.post(f"{API}/transactions", json=body, timeout=15)
        assert r3.status_code == 200 and r4.status_code == 200
        assert r3.json()["id"] == t1["id"] and r4.json()["id"] == t1["id"]
        post2 = next(b for b in s.get(f"{API}/banks", timeout=15).json() if b["id"] == TestIdempotency._bank_id)
        assert post2["current_balance"] == pre_bal + 500.0, \
            "Bank balance changed on further duplicates!"

    def test_4_different_client_id_creates_distinct_txn(self, s, staff_id):
        cid1 = str(uuid.uuid4())
        cid2 = str(uuid.uuid4())
        body = lambda cid: {
            "type": "IN", "category": "Cash Sale", "amount": 33,
            "staff_id": staff_id, "payment_method": "CASH", "client_id": cid,
        }
        r1 = s.post(f"{API}/transactions", json=body(cid1), timeout=15)
        r2 = s.post(f"{API}/transactions", json=body(cid2), timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["id"] != r2.json()["id"], "Distinct client_ids should yield distinct txns"

    def test_5_omit_client_id_creates_new_each_time(self, s, staff_id):
        body = {
            "type": "IN", "category": "Cash Sale", "amount": 12,
            "staff_id": staff_id, "payment_method": "CASH",
        }
        r1 = s.post(f"{API}/transactions", json=body, timeout=15)
        r2 = s.post(f"{API}/transactions", json=body, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        t1, t2 = r1.json(), r2.json()
        assert t1["id"] != t2["id"], "Legacy (no client_id) path should create distinct txns"
        # client_id in response can be null/absent
        assert t1.get("client_id") in (None, "")
        assert t2.get("client_id") in (None, "")

    def test_6_cleanup(self, s, staff_id):
        close_open_shift(s, staff_id)
