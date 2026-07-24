from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import bcrypt
import jwt as pyjwt
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="SELTRACK API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("seltrack")

# ---------- Constants ----------
INR_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1]
DEFAULT_STAFF = [
    {"name": "Rahul Sharma", "role": "Manager"},
    {"name": "Priya Patel", "role": "Cashier"},
    {"name": "Amit Kumar", "role": "Cashier"},
    {"name": "Sneha Iyer", "role": "Supervisor"},
]
DEFAULT_REASONS = {
    "IN": ["Cash Sale", "Deposit / Top-up", "Loan Repayment", "Other Income"],
    "OUT": ["Expense", "Vendor Payment", "Refund", "Payout / Withdrawal", "Other Expense"],
    "ADJUSTMENT": ["Cash Found", "Cash Missing", "Correction", "Manager Note"],
}
JWT_ALGO = "HS256"
JWT_EXPIRY_HOURS = 24

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_secret(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_secret(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_token(admin_id: str, mobile: str) -> str:
    payload = {
        "sub": admin_id,
        "mobile": mobile,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, jwt_secret(), algorithm=JWT_ALGO)

def decode_token(token: str) -> dict:
    return pyjwt.decode(token, jwt_secret(), algorithms=[JWT_ALGO])

async def get_current_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = auth[7:]
    try:
        payload = decode_token(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")
    admin = await db.admins.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0, "pin_hash": 0})
    if not admin:
        raise HTTPException(401, "Admin not found")
    return admin

# ---------- Models ----------
class Staff(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str = "Cashier"
    active: bool = True
    created_at: str = Field(default_factory=now_iso)

class StaffCreate(BaseModel):
    name: str
    role: str = "Cashier"

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None

class Denominations(BaseModel):
    d500: int = 0
    d200: int = 0
    d100: int = 0
    d50: int = 0
    d20: int = 0
    d10: int = 0
    d5: int = 0
    d2: int = 0
    d1: int = 0

    def total(self) -> float:
        return (self.d500 * 500 + self.d200 * 200 + self.d100 * 100 + self.d50 * 50
                + self.d20 * 20 + self.d10 * 10 + self.d5 * 5 + self.d2 * 2 + self.d1 * 1)

class Shift(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    opened_by_id: str
    opened_by_name: str
    opening_denominations: Denominations
    opening_amount: float
    opened_at: str = Field(default_factory=now_iso)
    closed_by_id: Optional[str] = None
    closed_by_name: Optional[str] = None
    closing_denominations: Optional[Denominations] = None
    closing_amount: Optional[float] = None
    expected_amount: Optional[float] = None
    variance: Optional[float] = None
    closed_at: Optional[str] = None
    status: Literal["OPEN", "CLOSED"] = "OPEN"
    note: Optional[str] = None

class ShiftOpen(BaseModel):
    staff_id: str
    denominations: Denominations
    note: Optional[str] = None

class ShiftClose(BaseModel):
    staff_id: str
    denominations: Denominations
    note: Optional[str] = None

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shift_id: str
    type: Literal["IN", "OUT", "ADJUSTMENT"]
    category: str
    amount: float
    note: Optional[str] = None
    staff_id: str
    staff_name: str
    payment_method: Literal["CASH", "UPI", "BANK"] = "CASH"
    bank_id: Optional[str] = None
    bank_name: Optional[str] = None
    drawer_opened: bool = True
    receipt_number: int = 0
    client_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

class TransactionCreate(BaseModel):
    type: Literal["IN", "OUT", "ADJUSTMENT"]
    category: str
    amount: float
    note: Optional[str] = None
    staff_id: str
    payment_method: Literal["CASH", "UPI", "BANK"] = "CASH"
    bank_id: Optional[str] = None
    drawer_opened: bool = True
    client_id: Optional[str] = None  # idempotency key

class Reason(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    category: Literal["IN", "OUT", "ADJUSTMENT"]
    is_default: bool = False
    active: bool = True
    created_at: str = Field(default_factory=now_iso)

class ReasonCreate(BaseModel):
    label: str
    category: Literal["IN", "OUT", "ADJUSTMENT"]

class Bank(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    account_number: Optional[str] = None
    opening_balance: float = 0.0
    current_balance: float = 0.0
    active: bool = True
    created_at: str = Field(default_factory=now_iso)

class BankCreate(BaseModel):
    name: str
    account_number: Optional[str] = None
    opening_balance: float = 0.0

class BankUpdate(BaseModel):
    name: Optional[str] = None
    account_number: Optional[str] = None
    active: Optional[bool] = None

class LoginBody(BaseModel):
    mobile: str
    password: str

class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str

class ChangePinBody(BaseModel):
    current_pin: str
    new_pin: str

class PinBody(BaseModel):
    pin: str

# ---------- Helpers ----------
async def seed_staff():
    if await db.staff.count_documents({}) == 0:
        for s in DEFAULT_STAFF:
            await db.staff.insert_one(Staff(**s).model_dump())
        logger.info("Seeded default staff.")

async def seed_reasons():
    if await db.reasons.count_documents({}) == 0:
        for cat, items in DEFAULT_REASONS.items():
            for label in items:
                r = Reason(label=label, category=cat, is_default=True)
                await db.reasons.insert_one(r.model_dump())
        logger.info("Seeded default reasons.")

async def seed_admin():
    mobile = os.environ.get("INITIAL_ADMIN_MOBILE", "9999999999")
    password = os.environ.get("INITIAL_ADMIN_PASSWORD", "admin123")
    pin = os.environ.get("INITIAL_ADMIN_PIN", "123456")
    existing = await db.admins.find_one({"mobile": mobile})
    if not existing:
        doc = {
            "id": str(uuid.uuid4()),
            "mobile": mobile,
            "name": "Administrator",
            "password_hash": hash_secret(password),
            "pin_hash": hash_secret(pin),
            "created_at": now_iso(),
        }
        await db.admins.insert_one(doc)
        logger.info(f"Seeded admin with mobile {mobile}.")

async def get_open_shift() -> Optional[dict]:
    return await db.shifts.find_one({"status": "OPEN"}, {"_id": 0})

async def compute_expected_cash(shift_id: str, opening_amount: float) -> float:
    """Expected cash balance for a shift — only CASH-method transactions affect the drawer."""
    pipeline = [
        {"$match": {"shift_id": shift_id, "payment_method": "CASH"}},
        {"$group": {"_id": "$type", "sum": {"$sum": "$amount"}}}
    ]
    totals = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    async for row in db.transactions.aggregate(pipeline):
        totals[row["_id"]] = row["sum"]
    return opening_amount + totals["IN"] - totals["OUT"] + totals["ADJUSTMENT"]

async def totals_by_method(shift_id: str) -> Dict[str, Dict[str, float]]:
    pipeline = [
        {"$match": {"shift_id": shift_id}},
        {"$group": {
            "_id": {"method": "$payment_method", "type": "$type"},
            "sum": {"$sum": "$amount"}
        }}
    ]
    out = {
        "CASH": {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0},
        "UPI": {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0},
        "BANK": {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0},
    }
    async for row in db.transactions.aggregate(pipeline):
        m = row["_id"].get("method") or "CASH"
        t = row["_id"].get("type")
        if m in out and t in out[m]:
            out[m][t] = row["sum"]
    return out

async def next_receipt_number() -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": "receipt"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return doc["seq"] if doc else 1

async def adjust_bank_balance(bank_id: str, txn_type: str, amount: float, undo: bool = False):
    """CASH ledger untouched. UPI/BANK txns adjust the bank's current_balance.
       IN => bank +amount, OUT => bank -amount, ADJUSTMENT => bank +amount (may be negative)."""
    if txn_type == "IN":
        delta = amount
    elif txn_type == "OUT":
        delta = -amount
    else:  # ADJUSTMENT
        delta = amount
    if undo:
        delta = -delta
    await db.banks.update_one({"id": bank_id}, {"$inc": {"current_balance": delta}})

# ---------- Public Routes ----------
@api_router.get("/")
async def root():
    return {"app": "SELTRACK", "status": "ok", "time": now_iso()}

# ---- Auth ----
@api_router.post("/auth/login")
async def auth_login(body: LoginBody):
    mobile = body.mobile.strip()
    admin = await db.admins.find_one({"mobile": mobile})
    if not admin or not verify_secret(body.password, admin["password_hash"]):
        raise HTTPException(401, "Invalid mobile or password")
    token = create_token(admin["id"], admin["mobile"])
    return {
        "token": token,
        "admin": {"id": admin["id"], "mobile": admin["mobile"], "name": admin["name"]},
    }

@api_router.get("/auth/me")
async def auth_me(admin: dict = Depends(get_current_admin)):
    return admin

@api_router.post("/auth/change-password")
async def auth_change_password(body: ChangePasswordBody, admin: dict = Depends(get_current_admin)):
    full = await db.admins.find_one({"id": admin["id"]})
    if not verify_secret(body.old_password, full["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    await db.admins.update_one({"id": admin["id"]}, {"$set": {"password_hash": hash_secret(body.new_password)}})
    return {"ok": True}

@api_router.post("/auth/change-pin")
async def auth_change_pin(body: ChangePinBody, admin: dict = Depends(get_current_admin)):
    full = await db.admins.find_one({"id": admin["id"]})
    if not verify_secret(body.current_pin, full["pin_hash"]):
        raise HTTPException(400, "Current PIN is incorrect")
    if not (body.new_pin.isdigit() and 4 <= len(body.new_pin) <= 6):
        raise HTTPException(400, "PIN must be 4–6 digits")
    await db.admins.update_one({"id": admin["id"]}, {"$set": {"pin_hash": hash_secret(body.new_pin)}})
    return {"ok": True}

@api_router.post("/auth/verify-pin")
async def auth_verify_pin(body: PinBody, admin: dict = Depends(get_current_admin)):
    full = await db.admins.find_one({"id": admin["id"]})
    if not verify_secret(body.pin, full["pin_hash"]):
        raise HTTPException(403, "Incorrect PIN")
    return {"ok": True}

# ---- Staff ----
@api_router.get("/staff", response_model=List[Staff])
async def list_staff():
    await seed_staff()
    return await db.staff.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(500)

@api_router.post("/staff", response_model=Staff)
async def create_staff(payload: StaffCreate):
    s = Staff(**payload.model_dump())
    await db.staff.insert_one(s.model_dump())
    return s

@api_router.patch("/staff/{staff_id}", response_model=Staff)
async def update_staff(staff_id: str, payload: StaffUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.staff.update_one({"id": staff_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Staff not found")
    return await db.staff.find_one({"id": staff_id}, {"_id": 0})

@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str):
    res = await db.staff.update_one({"id": staff_id}, {"$set": {"active": False}})
    if res.matched_count == 0:
        raise HTTPException(404, "Staff not found")
    return {"ok": True, "id": staff_id}

# ---- Reasons ----
@api_router.get("/reasons", response_model=List[Reason])
async def list_reasons(category: Optional[str] = None):
    await seed_reasons()
    q = {"active": True}
    if category:
        q["category"] = category
    return await db.reasons.find(q, {"_id": 0}).sort("label", 1).to_list(500)

@api_router.post("/reasons", response_model=Reason)
async def create_reason(payload: ReasonCreate):
    label = payload.label.strip()
    if not label:
        raise HTTPException(400, "Label required")
    existing = await db.reasons.find_one({"label": label, "category": payload.category, "active": True})
    if existing:
        return {**existing, "_id": None}
    r = Reason(label=label, category=payload.category)
    await db.reasons.insert_one(r.model_dump())
    return r

@api_router.delete("/reasons/{reason_id}")
async def delete_reason(reason_id: str, admin: dict = Depends(get_current_admin)):
    res = await db.reasons.update_one({"id": reason_id, "is_default": False}, {"$set": {"active": False}})
    if res.matched_count == 0:
        raise HTTPException(400, "Cannot delete default reasons")
    return {"ok": True}

# ---- Banks ----
@api_router.get("/banks", response_model=List[Bank])
async def list_banks():
    return await db.banks.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(200)

@api_router.post("/banks", response_model=Bank)
async def create_bank(payload: BankCreate, admin: dict = Depends(get_current_admin)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Bank name required")
    b = Bank(
        name=name,
        account_number=payload.account_number,
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance,
    )
    await db.banks.insert_one(b.model_dump())
    return b

@api_router.patch("/banks/{bank_id}", response_model=Bank)
async def update_bank(bank_id: str, payload: BankUpdate, admin: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.banks.update_one({"id": bank_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Bank not found")
    return await db.banks.find_one({"id": bank_id}, {"_id": 0})

@api_router.delete("/banks/{bank_id}")
async def delete_bank(bank_id: str, admin: dict = Depends(get_current_admin)):
    res = await db.banks.update_one({"id": bank_id}, {"$set": {"active": False}})
    if res.matched_count == 0:
        raise HTTPException(404, "Bank not found")
    return {"ok": True}

# ---- Shifts ----
@api_router.get("/shifts/current")
async def current_shift():
    shift = await get_open_shift()
    if not shift:
        return {"shift": None, "balance": 0.0, "totals_by_method": None, "banks": []}
    expected = await compute_expected_cash(shift["id"], shift["opening_amount"])
    totals = await totals_by_method(shift["id"])
    banks = await db.banks.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(200)
    return {"shift": shift, "balance": expected, "totals_by_method": totals, "banks": banks}

@api_router.post("/shifts/open", response_model=Shift)
async def open_shift(payload: ShiftOpen):
    if await get_open_shift():
        raise HTTPException(400, "A shift is already open. Close it first.")
    staff = await db.staff.find_one({"id": payload.staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(404, "Staff not found")
    denom = payload.denominations
    shift = Shift(
        opened_by_id=staff["id"],
        opened_by_name=staff["name"],
        opening_denominations=denom,
        opening_amount=denom.total(),
        note=payload.note,
    )
    await db.shifts.insert_one(shift.model_dump())
    return shift

@api_router.post("/shifts/close", response_model=Shift)
async def close_shift(payload: ShiftClose):
    shift = await get_open_shift()
    if not shift:
        raise HTTPException(400, "No open shift to close.")
    staff = await db.staff.find_one({"id": payload.staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(404, "Staff not found")
    closing = payload.denominations
    closing_amount = closing.total()
    expected = await compute_expected_cash(shift["id"], shift["opening_amount"])
    variance = closing_amount - expected
    update = {
        "closed_by_id": staff["id"],
        "closed_by_name": staff["name"],
        "closing_denominations": closing.model_dump(),
        "closing_amount": closing_amount,
        "expected_amount": expected,
        "variance": variance,
        "closed_at": now_iso(),
        "status": "CLOSED",
        "note": payload.note or shift.get("note"),
    }
    await db.shifts.update_one({"id": shift["id"]}, {"$set": update})
    return await db.shifts.find_one({"id": shift["id"]}, {"_id": 0})

@api_router.get("/shifts", response_model=List[Shift])
async def list_shifts(limit: int = 50):
    return await db.shifts.find({}, {"_id": 0}).sort("opened_at", -1).to_list(limit)

@api_router.get("/shifts/{shift_id}")
async def get_shift(shift_id: str):
    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Shift not found")
    txns = await db.transactions.find({"shift_id": shift_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    expected = await compute_expected_cash(shift_id, shift["opening_amount"])
    return {"shift": shift, "transactions": txns, "expected": expected}

# ---- Transactions ----
@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(payload: TransactionCreate):
    # Idempotency guard
    if payload.client_id:
        existing = await db.transactions.find_one({"client_id": payload.client_id}, {"_id": 0})
        if existing:
            return existing

    shift = await get_open_shift()
    if not shift:
        raise HTTPException(400, "No open shift. Open a shift before recording transactions.")
    staff = await db.staff.find_one({"id": payload.staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(404, "Staff not found")
    if payload.amount <= 0 and payload.type != "ADJUSTMENT":
        raise HTTPException(400, "Amount must be positive for IN/OUT transactions.")

    bank = None
    if payload.payment_method in ("UPI", "BANK"):
        if not payload.bank_id:
            raise HTTPException(400, "Bank is required for UPI/BANK transactions.")
        bank = await db.banks.find_one({"id": payload.bank_id, "active": True}, {"_id": 0})
        if not bank:
            raise HTTPException(404, "Bank not found or inactive")

    receipt_no = await next_receipt_number()
    txn = Transaction(
        shift_id=shift["id"],
        type=payload.type,
        category=payload.category,
        amount=payload.amount,
        note=payload.note,
        staff_id=staff["id"],
        staff_name=staff["name"],
        payment_method=payload.payment_method,
        bank_id=bank["id"] if bank else None,
        bank_name=bank["name"] if bank else None,
        drawer_opened=payload.drawer_opened if payload.payment_method == "CASH" else False,
        receipt_number=receipt_no,
        client_id=payload.client_id,
    )
    await db.transactions.insert_one(txn.model_dump())
    if bank:
        try:
            await adjust_bank_balance(bank["id"], payload.type, payload.amount, undo=False)
        except Exception as e:
            # Roll back the transaction insert so ledger stays consistent
            await db.transactions.delete_one({"id": txn.id})
            logger.exception("Bank balance update failed; rolled back transaction")
            raise HTTPException(500, f"Bank balance update failed: {e}")
    return txn

@api_router.get("/transactions", response_model=List[Transaction])
async def list_transactions(shift_id: Optional[str] = None, limit: int = 200, method: Optional[str] = None):
    # If caller doesn't specify a shift, only return the currently open shift's txns.
    # Never return "all" — that would leak historical rows into the live feed.
    q = {}
    if shift_id:
        q["shift_id"] = shift_id
    else:
        open_shift = await get_open_shift()
        if not open_shift:
            return []
        q["shift_id"] = open_shift["id"]
    if method:
        q["payment_method"] = method
    return await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)

# ---- Reports ----
@api_router.get("/reports/x")
async def x_report(shift_id: Optional[str] = None):
    shift = None
    if shift_id:
        shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    else:
        shift = await get_open_shift()
    if not shift:
        raise HTTPException(404, "Shift not found")
    txns = await db.transactions.find({"shift_id": shift["id"]}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    totals = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    by_category: Dict[str, float] = {}
    for t in txns:
        totals[t["type"]] += t["amount"]
        key = f"{t['type']}:{t['category']}"
        by_category[key] = by_category.get(key, 0.0) + t["amount"]
    methods = await totals_by_method(shift["id"])
    expected = shift["opening_amount"] + methods["CASH"]["IN"] - methods["CASH"]["OUT"] + methods["CASH"]["ADJUSTMENT"]
    return {
        "report_type": "X",
        "generated_at": now_iso(),
        "shift": shift,
        "totals": totals,
        "totals_by_method": methods,
        "by_category": by_category,
        "transaction_count": len(txns),
        "expected_amount": expected,
        "transactions": txns,
    }

@api_router.get("/reports/z")
async def z_report(shift_id: str):
    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Shift not found")
    if shift["status"] != "CLOSED":
        raise HTTPException(400, "Z-Report requires a CLOSED shift.")
    txns = await db.transactions.find({"shift_id": shift_id}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    totals = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    by_category: Dict[str, float] = {}
    for t in txns:
        totals[t["type"]] += t["amount"]
        key = f"{t['type']}:{t['category']}"
        by_category[key] = by_category.get(key, 0.0) + t["amount"]
    methods = await totals_by_method(shift_id)
    return {
        "report_type": "Z",
        "generated_at": now_iso(),
        "shift": shift,
        "totals": totals,
        "totals_by_method": methods,
        "by_category": by_category,
        "transaction_count": len(txns),
        "transactions": txns,
    }

@api_router.get("/reports/daily")
async def daily_report(day: Optional[str] = None):
    target = day or datetime.now(timezone.utc).date().isoformat()
    start = f"{target}T00:00:00+00:00"
    end = f"{target}T23:59:59+00:00"
    shifts = await db.shifts.find({"opened_at": {"$gte": start, "$lte": end}}, {"_id": 0}).sort("opened_at", 1).to_list(200)
    shift_ids = [s["id"] for s in shifts]
    txns = await db.transactions.find({"shift_id": {"$in": shift_ids}}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    totals = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    method_totals = {
        "CASH": {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0},
        "UPI": {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0},
        "BANK": {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0},
    }
    for t in txns:
        totals[t["type"]] += t["amount"]
        m = t.get("payment_method") or "CASH"
        if m in method_totals:
            method_totals[m][t["type"]] += t["amount"]
    return {
        "date": target,
        "shift_count": len(shifts),
        "transaction_count": len(txns),
        "totals": totals,
        "totals_by_method": method_totals,
        "shifts": shifts,
        "transactions": txns,
    }

# ---- Admin Dashboard aggregate ----
@api_router.get("/admin/dashboard")
async def admin_dashboard(admin: dict = Depends(get_current_admin)):
    shift = await get_open_shift()
    cash_balance = 0.0
    methods = None
    txns_recent = []
    if shift:
        cash_balance = await compute_expected_cash(shift["id"], shift["opening_amount"])
        methods = await totals_by_method(shift["id"])
        txns_recent = await db.transactions.find({"shift_id": shift["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    banks = await db.banks.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(200)
    bank_total = sum(b.get("current_balance", 0.0) for b in banks)
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "shift": shift,
        "cash_balance": cash_balance,
        "totals_by_method": methods,
        "banks": banks,
        "bank_total": bank_total,
        "recent_transactions": txns_recent,
        "today": today,
    }

# ---- Admin destructive ops (PIN-gated) ----
@api_router.post("/admin/reset")
async def reset_data(body: PinBody, keep_staff: bool = Query(True), admin: dict = Depends(get_current_admin)):
    full = await db.admins.find_one({"id": admin["id"]})
    if not verify_secret(body.pin, full["pin_hash"]):
        raise HTTPException(403, "Incorrect admin PIN")
    open_shift = await get_open_shift()
    if open_shift:
        raise HTTPException(400, "Close the open shift before resetting data.")
    t = await db.transactions.delete_many({})
    s = await db.shifts.delete_many({})
    c = await db.counters.delete_many({})
    # reset bank balances to opening_balance
    async for b in db.banks.find({}):
        await db.banks.update_one({"id": b["id"]}, {"$set": {"current_balance": b.get("opening_balance", 0.0)}})
    st = 0
    if not keep_staff:
        r = await db.staff.delete_many({})
        st = r.deleted_count
    return {
        "transactions_deleted": t.deleted_count,
        "shifts_deleted": s.deleted_count,
        "counters_deleted": c.deleted_count,
        "staff_deleted": st,
    }

# ---- Meta ----
@api_router.get("/meta/denominations")
async def get_denominations():
    return {"currency": "INR", "symbol": "₹", "denominations": INR_DENOMINATIONS}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await seed_staff()
    await seed_reasons()
    await seed_admin()
    # Idempotency index on transactions.client_id (sparse — legacy rows without client_id are OK)
    try:
        await db.transactions.create_index("client_id", unique=True, sparse=True)
    except Exception as e:
        logger.warning(f"transactions.client_id index: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
