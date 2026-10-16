"""
Iteration 6 — Partial index fix regression:
- DB-level: transactions collection must contain 'client_id_unique_partial'
  with partialFilterExpression {'client_id': {'$type': 'string'}}
  and NO legacy 'client_id_1' sparse index.
- Mixing: POST with client_id then without client_id → creates two distinct txns.
- Explicit repro: two POSTs without client_id → distinct txns with distinct receipt_numbers.
- Regression: same client_id → same txn (idempotency preserved).
- Different client_ids → distinct txns.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

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
def staff_id(s):
    r = s.get(f"{API}/staff", timeout=15)
    assert r.status_code == 200
    return r.json()[0]["id"]


@pytest.fixture(scope="module")
def open_shift(s, staff_id):
    # Close any pre-existing open shift
    cur = s.get(f"{API}/shifts/current", timeout=15).json()
    if cur.get("shift"):
        s.post(f"{API}/shifts/close",
               json={"staff_id": staff_id, "denominations": denom(), "note": "cleanup"}, timeout=15)
    op = s.post(f"{API}/shifts/open",
                json={"staff_id": staff_id, "denominations": denom(d500=6)}, timeout=15)
    assert op.status_code == 200, op.text
    yield op.json()
    s.post(f"{API}/shifts/close",
           json={"staff_id": staff_id, "denominations": denom(), "note": "test cleanup"}, timeout=15)


class TestIndex:
    def test_partial_index_present_and_legacy_sparse_absent(self):
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        idx = list(db.transactions.list_indexes())
        names = {i.get("name") for i in idx}
        # Print for diagnostics
        for i in idx:
            print(i)
        assert "client_id_unique_partial" in names, f"Partial index missing. Found indexes: {names}"
        assert "client_id_1" not in names, "Legacy sparse index 'client_id_1' should have been dropped"

        # Validate partial index definition
        partial = next(i for i in idx if i["name"] == "client_id_unique_partial")
        assert partial.get("unique") is True
        pfe = partial.get("partialFilterExpression")
        assert pfe == {"client_id": {"$type": "string"}}, f"Unexpected partialFilterExpression: {pfe}"
        client.close()


class TestExplicitRepro:
    def test_two_posts_no_client_id_distinct(self, s, staff_id, open_shift):
        body = {
            "type": "IN", "category": "Cash Sale", "amount": 12,
            "staff_id": staff_id, "payment_method": "CASH",
        }
        r1 = s.post(f"{API}/transactions", json=body, timeout=15)
        r2 = s.post(f"{API}/transactions", json=body, timeout=15)
        assert r1.status_code == 200, r1.text
        assert r2.status_code == 200, r2.text
        t1, t2 = r1.json(), r2.json()
        assert t1["id"] != t2["id"], "No-client_id path must yield distinct txn ids"
        assert t1["receipt_number"] != t2["receipt_number"], "Receipt numbers must be distinct"


class TestMixing:
    def test_with_then_without_client_id(self, s, staff_id, open_shift):
        cid = str(uuid.uuid4())
        r1 = s.post(f"{API}/transactions", json={
            "type": "IN", "category": "Cash Sale", "amount": 77,
            "staff_id": staff_id, "payment_method": "CASH", "client_id": cid,
        }, timeout=15)
        assert r1.status_code == 200, r1.text
        r2 = s.post(f"{API}/transactions", json={
            "type": "IN", "category": "Cash Sale", "amount": 77,
            "staff_id": staff_id, "payment_method": "CASH",
        }, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r1.json()["id"] != r2.json()["id"], "Mixing client_id present/absent should not conflict"


class TestIdempotencyRegression:
    def test_same_client_id_same_txn(self, s, staff_id, open_shift):
        cid = str(uuid.uuid4())
        body = {
            "type": "IN", "category": "Cash Sale", "amount": 42,
            "staff_id": staff_id, "payment_method": "CASH", "client_id": cid,
        }
        r1 = s.post(f"{API}/transactions", json=body, timeout=15)
        r2 = s.post(f"{API}/transactions", json=body, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"], "Same client_id must be idempotent"
        assert r1.json()["receipt_number"] == r2.json()["receipt_number"]

    def test_different_client_ids_distinct(self, s, staff_id, open_shift):
        b = lambda cid: {
            "type": "IN", "category": "Cash Sale", "amount": 9,
            "staff_id": staff_id, "payment_method": "CASH", "client_id": cid,
        }
        r1 = s.post(f"{API}/transactions", json=b(str(uuid.uuid4())), timeout=15)
        r2 = s.post(f"{API}/transactions", json=b(str(uuid.uuid4())), timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["id"] != r2.json()["id"]
