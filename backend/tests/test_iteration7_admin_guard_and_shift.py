"""
Iteration 7 backend tests:
 (1) POST/PATCH/DELETE /api/staff require admin Bearer token → 401 without, success with.
 (2) GET /api/staff, GET /api/banks, GET /api/reasons remain PUBLIC.
 (3) POST /api/banks / DELETE /api/reasons still require admin (regression).
 (4) Shift open works without any drawer knowledge; UPI transaction succeeds with valid bank_id,
     bank balance updates by +amount for IN.
 (5) Idempotency regression: two POSTs with same client_id return SAME txn.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_MOBILE = "9999999999"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def a_staff_id():
    r = requests.get(f"{API}/staff")
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) > 0
    return lst[0]["id"]


# ---------- (1) Staff mutation auth gate ----------
class TestStaffAuthGate:
    def test_post_staff_without_token_401(self):
        r = requests.post(f"{API}/staff", json={"name": "TEST_NoAuth", "role": "Cashier"})
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"

    def test_patch_staff_without_token_401(self, a_staff_id):
        r = requests.patch(f"{API}/staff/{a_staff_id}", json={"name": "TEST_Hack"})
        assert r.status_code == 401

    def test_delete_staff_without_token_401(self, a_staff_id):
        r = requests.delete(f"{API}/staff/{a_staff_id}")
        assert r.status_code == 401

    def test_post_staff_with_token_success(self, auth_headers):
        payload = {"name": f"TEST_Staff_{uuid.uuid4().hex[:6]}", "role": "Cashier"}
        r = requests.post(f"{API}/staff", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == payload["name"]
        assert d["role"] == "Cashier"
        assert d.get("active") is True
        assert "id" in d

        # verify persistence via public GET
        listed = requests.get(f"{API}/staff").json()
        assert any(s["id"] == d["id"] for s in listed)

        # cleanup with authed DELETE (soft-delete)
        rd = requests.delete(f"{API}/staff/{d['id']}", headers=auth_headers)
        assert rd.status_code == 200

    def test_patch_staff_with_token_success(self, auth_headers):
        # create → patch → verify → cleanup
        c = requests.post(f"{API}/staff",
                          json={"name": f"TEST_Patch_{uuid.uuid4().hex[:6]}", "role": "Cashier"},
                          headers=auth_headers)
        assert c.status_code == 200
        sid = c.json()["id"]

        p = requests.patch(f"{API}/staff/{sid}", json={"role": "Manager"}, headers=auth_headers)
        assert p.status_code == 200, p.text
        assert p.json()["role"] == "Manager"

        # GET verification through list (only active + this name)
        listed = requests.get(f"{API}/staff").json()
        row = next((x for x in listed if x["id"] == sid), None)
        assert row and row["role"] == "Manager"

        requests.delete(f"{API}/staff/{sid}", headers=auth_headers)

    def test_delete_staff_with_token_success(self, auth_headers):
        c = requests.post(f"{API}/staff",
                          json={"name": f"TEST_Del_{uuid.uuid4().hex[:6]}", "role": "Cashier"},
                          headers=auth_headers)
        sid = c.json()["id"]
        d = requests.delete(f"{API}/staff/{sid}", headers=auth_headers)
        assert d.status_code == 200
        # after soft-delete, id is NOT in the public active list
        listed = requests.get(f"{API}/staff").json()
        assert not any(s["id"] == sid for s in listed)


# ---------- (2) Public reads regression ----------
class TestPublicReads:
    def test_get_staff_public(self):
        r = requests.get(f"{API}/staff")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_banks_public(self):
        r = requests.get(f"{API}/banks")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_reasons_public(self):
        r = requests.get(f"{API}/reasons")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- (3) Bank/reason mutation regressions ----------
class TestOtherMutationsStillGuarded:
    def test_post_banks_without_token_401(self):
        r = requests.post(f"{API}/banks", json={"name": "TEST_NoAuthBank", "opening_balance": 0})
        assert r.status_code == 401

    def test_delete_reason_without_token_401(self):
        # use a fake id — auth must be checked before existence
        r = requests.delete(f"{API}/reasons/does-not-exist-id")
        assert r.status_code == 401


# ---------- (4) Shift open (drawer offline) + UPI txn ----------
class TestShiftAndUpiFlow:
    """Backend has no notion of drawer; opening a shift just accepts denominations."""

    @pytest.fixture(scope="class")
    def bank_id(self, auth_headers):
        # create dedicated TEST bank with known opening balance
        payload = {"name": f"TEST_UPIBank_{uuid.uuid4().hex[:6]}", "opening_balance": 1000.0}
        r = requests.post(f"{API}/banks", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["current_balance"] == 1000.0
        yield b["id"]
        # cleanup — soft-delete
        requests.delete(f"{API}/banks/{b['id']}", headers=auth_headers)

    @pytest.fixture(scope="class")
    def clean_shift(self, auth_headers, a_staff_id):
        # ensure no open shift lingers from a previous run
        cur = requests.get(f"{API}/shifts/current").json()
        if cur.get("shift"):
            requests.post(f"{API}/shifts/close",
                          json={"staff_id": a_staff_id, "denominations": {}, "note": "iter7 cleanup"})
        yield

    def test_open_shift_without_drawer_context(self, clean_shift, a_staff_id):
        r = requests.post(f"{API}/shifts/open",
                          json={"staff_id": a_staff_id,
                                "denominations": {"d500": 2, "d100": 5, "d50": 0},
                                "note": "TEST iter7 open (drawer offline)"})
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["status"] == "OPEN"
        assert s["opened_by_id"] == a_staff_id
        assert s["opening_amount"] == 2 * 500 + 5 * 100  # 1500

        cur = requests.get(f"{API}/shifts/current").json()
        assert cur["shift"]["id"] == s["id"]

    def test_upi_transaction_with_bank(self, bank_id, a_staff_id):
        # snapshot bank balance
        before = next(b for b in requests.get(f"{API}/banks").json() if b["id"] == bank_id)
        r = requests.post(f"{API}/transactions",
                          json={"type": "IN", "category": "Cash Sale",
                                "amount": 350.0, "staff_id": a_staff_id,
                                "payment_method": "UPI", "bank_id": bank_id,
                                "note": "TEST iter7 UPI"})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["payment_method"] == "UPI"
        assert t["bank_id"] == bank_id
        assert t["amount"] == 350.0
        assert t["drawer_opened"] is False  # UPI never triggers drawer flag

        after = next(b for b in requests.get(f"{API}/banks").json() if b["id"] == bank_id)
        assert round(after["current_balance"] - before["current_balance"], 2) == 350.0

    def test_upi_requires_bank_id(self, a_staff_id):
        r = requests.post(f"{API}/transactions",
                          json={"type": "IN", "category": "Cash Sale",
                                "amount": 100, "staff_id": a_staff_id,
                                "payment_method": "UPI"})
        assert r.status_code == 400
        assert "bank" in r.text.lower()

    def test_close_shift_offline(self, a_staff_id):
        r = requests.post(f"{API}/shifts/close",
                          json={"staff_id": a_staff_id,
                                "denominations": {"d500": 2, "d100": 5},
                                "note": "TEST iter7 close (drawer offline)"})
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["status"] == "CLOSED"
        assert s["closed_by_id"] == a_staff_id
        assert s["closing_amount"] == 1500.0
        # CASH-only expected balance since UPI does not affect drawer
        assert s["expected_amount"] == 1500.0
        assert s["variance"] == 0.0


# ---------- (5) Idempotency regression ----------
class TestIdempotencyRegression:
    def test_same_client_id_returns_same_txn(self, auth_headers, a_staff_id):
        # setup — open a shift
        cur = requests.get(f"{API}/shifts/current").json()
        if not cur.get("shift"):
            ropen = requests.post(f"{API}/shifts/open",
                                  json={"staff_id": a_staff_id,
                                        "denominations": {"d100": 1},
                                        "note": "TEST iter7 idem shift"})
            assert ropen.status_code == 200

        cid = f"iter7-{uuid.uuid4()}"
        body = {"type": "IN", "category": "Cash Sale",
                "amount": 55.0, "staff_id": a_staff_id,
                "payment_method": "CASH", "client_id": cid}
        r1 = requests.post(f"{API}/transactions", json=body)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/transactions", json=body)
        assert r2.status_code == 200, r2.text
        assert r1.json()["id"] == r2.json()["id"], "same client_id should return same txn"
        assert r1.json()["receipt_number"] == r2.json()["receipt_number"]

        # cleanup — close shift
        requests.post(f"{API}/shifts/close",
                      json={"staff_id": a_staff_id, "denominations": {"d100": 1, "d50": 1},
                            "note": "TEST iter7 idem cleanup"})
