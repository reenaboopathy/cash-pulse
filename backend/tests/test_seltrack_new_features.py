"""
SELTRACK — New features regression tests (Iteration 4)

Covers:
- Root + admin auth (login / me / verify-pin / change-pin round trip)
- Reasons GET/POST (idempotent)
- Banks CRUD (auth-gated) + current_balance auto-adjust from txns
- Transactions with payment_method (CASH / UPI / BANK) and per-shift totals_by_method
- /api/reports/x totals_by_method breakdown
- /api/admin/dashboard (auth + shape)
- /api/admin/reset PIN-gated + open-shift blocker

Serial execution required — shared open shift.
    pytest backend/tests/test_seltrack_new_features.py -v -n 0
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_MOBILE = "9999999999"
ADMIN_PASSWORD = "admin123"
ADMIN_PIN = "123456"


# ---------- helpers ----------
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


def _close_open_shift(s, staff_id):
    cur = s.get(f"{API}/shifts/current", timeout=15).json()
    if cur.get("shift"):
        # match expected to leave variance ok; use closing = expected via denom that totals to balance is complex.
        # Server allows any closing; variance is diagnostic only. Use zeros.
        s.post(f"{API}/shifts/close", json={"staff_id": staff_id, "denominations": denom(), "note": "cleanup"}, timeout=15)


@pytest.fixture(scope="module", autouse=True)
def _clean_start(s, staff_id):
    _close_open_shift(s, staff_id)
    yield
    _close_open_shift(s, staff_id)


# ============================================================
# Root
# ============================================================
class TestRoot:
    def test_root_ok(self, s):
        r = s.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert b["app"] == "SELTRACK"
        assert b["status"] == "ok"


# ============================================================
# Auth
# ============================================================
class TestAuth:
    def test_login_success(self, s):
        r = s.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert "admin" in data
        for k in ("id", "mobile", "name"):
            assert k in data["admin"]
        assert data["admin"]["mobile"] == ADMIN_MOBILE
        # ensure no hashes leaked
        assert "password_hash" not in data["admin"]
        assert "pin_hash" not in data["admin"]

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": "wrong-xxxxx"}, timeout=15)
        assert r.status_code == 401

    def test_me_returns_admin_no_hashes(self, s, auth_headers):
        r = s.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["mobile"] == ADMIN_MOBILE
        assert "password_hash" not in me
        assert "pin_hash" not in me

    def test_me_without_token_401(self, s):
        r = s.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_verify_pin_success(self, s, auth_headers):
        r = s.post(f"{API}/auth/verify-pin", headers=auth_headers, json={"pin": ADMIN_PIN}, timeout=15)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_verify_pin_wrong_returns_403(self, s, auth_headers):
        r = s.post(f"{API}/auth/verify-pin", headers=auth_headers, json={"pin": "000000"}, timeout=15)
        assert r.status_code == 403

    def test_change_pin_roundtrip(self, s, auth_headers):
        # 123456 -> 654321
        r = s.post(f"{API}/auth/change-pin", headers=auth_headers,
                   json={"current_pin": ADMIN_PIN, "new_pin": "654321"}, timeout=15)
        assert r.status_code == 200, r.text
        # verify the new one works
        r2 = s.post(f"{API}/auth/verify-pin", headers=auth_headers, json={"pin": "654321"}, timeout=15)
        assert r2.status_code == 200
        # and old one now fails
        r3 = s.post(f"{API}/auth/verify-pin", headers=auth_headers, json={"pin": ADMIN_PIN}, timeout=15)
        assert r3.status_code == 403
        # restore original
        r4 = s.post(f"{API}/auth/change-pin", headers=auth_headers,
                    json={"current_pin": "654321", "new_pin": ADMIN_PIN}, timeout=15)
        assert r4.status_code == 200
        # confirm restored
        r5 = s.post(f"{API}/auth/verify-pin", headers=auth_headers, json={"pin": ADMIN_PIN}, timeout=15)
        assert r5.status_code == 200


# ============================================================
# Reasons
# ============================================================
class TestReasons:
    def test_reasons_seed_includes_cash_sale(self, s):
        r = s.get(f"{API}/reasons", params={"category": "IN"}, timeout=15)
        assert r.status_code == 200
        labels = {x["label"] for x in r.json()}
        assert "Cash Sale" in labels

    def test_create_reason_and_idempotent(self, s):
        payload = {"label": "Merchandise Sale", "category": "IN"}
        r = s.post(f"{API}/reasons", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["label"] == "Merchandise Sale"
        assert data["category"] == "IN"
        # Second create returns existing (idempotent)
        r2 = s.post(f"{API}/reasons", json=payload, timeout=15)
        assert r2.status_code == 200
        # GET returns it
        r3 = s.get(f"{API}/reasons", params={"category": "IN"}, timeout=15)
        labels = {x["label"] for x in r3.json()}
        assert "Merchandise Sale" in labels


# ============================================================
# Banks CRUD + auth
# ============================================================
class TestBanks:
    def test_create_bank_unauth_401(self, s):
        r = s.post(f"{API}/banks", json={"name": "HDFC UnauthTest", "opening_balance": 100}, timeout=15)
        assert r.status_code == 401

    def test_create_bank_with_token(self, s, auth_headers):
        r = s.post(f"{API}/banks", headers=auth_headers,
                   json={"name": "TEST_HDFC Current", "opening_balance": 5000}, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["name"] == "TEST_HDFC Current"
        assert b["opening_balance"] == 5000
        assert b["current_balance"] == 5000
        TestBanks._bid = b["id"]
        # GET lists it
        r2 = s.get(f"{API}/banks", timeout=15)
        assert any(x["id"] == b["id"] for x in r2.json())

    def test_patch_bank_name(self, s, auth_headers):
        r = s.patch(f"{API}/banks/{TestBanks._bid}", headers=auth_headers,
                    json={"name": "TEST_HDFC Current v2"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_HDFC Current v2"

    def test_delete_bank_deactivates(self, s, auth_headers):
        # create a throwaway bank to delete
        r = s.post(f"{API}/banks", headers=auth_headers,
                   json={"name": "TEST_ToBeDeleted", "opening_balance": 1}, timeout=15)
        assert r.status_code == 200
        bid = r.json()["id"]
        d = s.delete(f"{API}/banks/{bid}", headers=auth_headers, timeout=15)
        assert d.status_code == 200
        # GET banks should not list it (only active=true)
        r2 = s.get(f"{API}/banks", timeout=15)
        assert not any(x["id"] == bid for x in r2.json())


# ============================================================
# Transactions with payment_method
# ============================================================
class TestTxnMethods:
    def test_prepare_shift_and_bank(self, s, staff_id, auth_headers):
        # Ensure a bank with opening 10000 exists for this flow
        r = s.post(f"{API}/banks", headers=auth_headers,
                   json={"name": "TEST_FlowBank", "opening_balance": 10000}, timeout=15)
        assert r.status_code == 200
        TestTxnMethods._bank = r.json()
        TestTxnMethods._bid = r.json()["id"]

        # ensure an open shift exists
        cur = s.get(f"{API}/shifts/current", timeout=15).json()
        if not cur.get("shift"):
            op = s.post(f"{API}/shifts/open",
                        json={"staff_id": staff_id, "denominations": denom(d500=6)}, timeout=15)
            assert op.status_code == 200, op.text
            TestTxnMethods._shift = op.json()
        else:
            TestTxnMethods._shift = cur["shift"]

    def test_upi_in_increases_bank(self, s, staff_id):
        r = s.post(f"{API}/transactions", json={
            "type": "IN", "category": "UPI Sale", "amount": 1500,
            "staff_id": staff_id, "payment_method": "UPI", "bank_id": TestTxnMethods._bid,
        }, timeout=15)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["payment_method"] == "UPI"
        assert t["bank_id"] == TestTxnMethods._bid
        assert t["drawer_opened"] is False
        # bank balance now 11500
        banks = s.get(f"{API}/banks", timeout=15).json()
        b = next(x for x in banks if x["id"] == TestTxnMethods._bid)
        assert b["current_balance"] == 11500.0

    def test_bank_out_decreases_bank(self, s, staff_id):
        r = s.post(f"{API}/transactions", json={
            "type": "OUT", "category": "Expense", "amount": 200,
            "staff_id": staff_id, "payment_method": "BANK", "bank_id": TestTxnMethods._bid,
        }, timeout=15)
        assert r.status_code == 200, r.text
        banks = s.get(f"{API}/banks", timeout=15).json()
        b = next(x for x in banks if x["id"] == TestTxnMethods._bid)
        assert b["current_balance"] == 11300.0

    def test_cash_in_does_not_touch_bank(self, s, staff_id):
        pre = next(x for x in s.get(f"{API}/banks", timeout=15).json() if x["id"] == TestTxnMethods._bid)
        r = s.post(f"{API}/transactions", json={
            "type": "IN", "category": "Cash Sale", "amount": 800,
            "staff_id": staff_id, "payment_method": "CASH",
        }, timeout=15)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["payment_method"] == "CASH"
        assert t.get("bank_id") in (None, "")
        post = next(x for x in s.get(f"{API}/banks", timeout=15).json() if x["id"] == TestTxnMethods._bid)
        assert post["current_balance"] == pre["current_balance"]

    def test_upi_without_bank_id_rejected(self, s, staff_id):
        r = s.post(f"{API}/transactions", json={
            "type": "IN", "category": "UPI Sale", "amount": 100,
            "staff_id": staff_id, "payment_method": "UPI",
        }, timeout=15)
        assert r.status_code == 400

    def test_current_shift_totals_by_method(self, s):
        r = s.get(f"{API}/shifts/current", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["shift"] is not None
        m = data["totals_by_method"]
        assert m is not None
        # Cash IN >= 800 (we did 800)
        assert m["CASH"]["IN"] >= 800.0
        assert m["UPI"]["IN"] == 1500.0
        assert m["BANK"]["OUT"] == 200.0
        # cash balance = opening + CASH.IN - CASH.OUT + CASH.ADJ (not UPI/BANK)
        opening = data["shift"]["opening_amount"]
        expected = opening + m["CASH"]["IN"] - m["CASH"]["OUT"] + m["CASH"]["ADJUSTMENT"]
        assert abs(data["balance"] - expected) < 1e-6

    def test_x_report_totals_by_method(self, s):
        r = s.get(f"{API}/reports/x", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "totals_by_method" in data
        m = data["totals_by_method"]
        assert m["UPI"]["IN"] == 1500.0
        assert m["BANK"]["OUT"] == 200.0
        assert m["CASH"]["IN"] >= 800.0


# ============================================================
# Admin dashboard
# ============================================================
class TestAdminDashboard:
    def test_dashboard_unauth_401(self, s):
        r = s.get(f"{API}/admin/dashboard", timeout=15)
        assert r.status_code == 401

    def test_dashboard_auth_shape(self, s, auth_headers):
        r = s.get(f"{API}/admin/dashboard", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("shift", "cash_balance", "totals_by_method", "banks", "bank_total", "recent_transactions", "today"):
            assert k in d, f"Missing key {k}"
        assert isinstance(d["banks"], list)
        assert isinstance(d["recent_transactions"], list) and len(d["recent_transactions"]) >= 3
        # bank_total equals sum of current_balance across active banks
        expected_total = sum(b.get("current_balance", 0.0) for b in d["banks"])
        assert abs(d["bank_total"] - expected_total) < 1e-6


# ============================================================
# Admin reset (PIN-gated)
# ============================================================
class TestAdminReset:
    def test_reset_wrong_pin_403(self, s, auth_headers):
        r = s.post(f"{API}/admin/reset", headers=auth_headers, json={"pin": "wrong0"}, timeout=15)
        assert r.status_code == 403

    def test_reset_blocked_when_shift_open(self, s, auth_headers):
        # shift is currently open (from previous flow)
        r = s.post(f"{API}/admin/reset", headers=auth_headers, json={"pin": ADMIN_PIN}, timeout=15)
        assert r.status_code == 400
        assert "shift" in r.text.lower()

    def test_reset_after_shift_close_ok(self, s, auth_headers, staff_id):
        _close_open_shift(s, staff_id)
        r = s.post(f"{API}/admin/reset", headers=auth_headers, json={"pin": ADMIN_PIN}, timeout=15)
        assert r.status_code == 200, r.text
        # after reset, banks still exist but current_balance reset to opening_balance
        banks = s.get(f"{API}/banks", timeout=15).json()
        assert len(banks) > 0
        for b in banks:
            assert b["current_balance"] == b["opening_balance"], f"Bank {b['name']} balance not reset"
