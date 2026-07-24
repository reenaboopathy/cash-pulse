from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict
import uuid
from datetime import datetime, timezone, date

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

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

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
    category: str  # e.g. Cash Sale, Expense, Refund, Payout, Correction
    amount: float  # positive; sign is applied by type
    note: Optional[str] = None
    staff_id: str
    staff_name: str
    drawer_opened: bool = True
    receipt_number: int = 0
    created_at: str = Field(default_factory=now_iso)

class TransactionCreate(BaseModel):
    type: Literal["IN", "OUT", "ADJUSTMENT"]
    category: str
    amount: float
    note: Optional[str] = None
    staff_id: str
    drawer_opened: bool = True

# ---------- Helpers ----------
async def seed_staff():
    count = await db.staff.count_documents({})
    if count == 0:
        for s in DEFAULT_STAFF:
            staff = Staff(**s)
            await db.staff.insert_one(staff.model_dump())
        logger.info("Seeded default staff.")

async def get_open_shift() -> Optional[dict]:
    return await db.shifts.find_one({"status": "OPEN"}, {"_id": 0})

async def compute_expected(shift_id: str, opening_amount: float) -> float:
    pipeline = [
        {"$match": {"shift_id": shift_id}},
        {"$group": {"_id": "$type", "sum": {"$sum": "$amount"}}}
    ]
    totals = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    async for row in db.transactions.aggregate(pipeline):
        totals[row["_id"]] = row["sum"]
    return opening_amount + totals["IN"] - totals["OUT"] + totals["ADJUSTMENT"]

async def next_receipt_number() -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": "receipt"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return doc["seq"] if doc else 1

# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"app": "SELTRACK", "status": "ok", "time": now_iso()}

# Staff
@api_router.get("/staff", response_model=List[Staff])
async def list_staff():
    await seed_staff()
    docs = await db.staff.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(500)
    return docs

@api_router.post("/staff", response_model=Staff)
async def create_staff(payload: StaffCreate):
    s = Staff(**payload.model_dump())
    await db.staff.insert_one(s.model_dump())
    return s

# Shifts
@api_router.get("/shifts/current")
async def current_shift():
    shift = await get_open_shift()
    if not shift:
        return {"shift": None, "balance": 0.0, "totals": {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}}
    expected = await compute_expected(shift["id"], shift["opening_amount"])
    pipeline = [
        {"$match": {"shift_id": shift["id"]}},
        {"$group": {"_id": "$type", "sum": {"$sum": "$amount"}}}
    ]
    totals = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    async for row in db.transactions.aggregate(pipeline):
        totals[row["_id"]] = row["sum"]
    return {"shift": shift, "balance": expected, "totals": totals}

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
    expected = await compute_expected(shift["id"], shift["opening_amount"])
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
    updated = await db.shifts.find_one({"id": shift["id"]}, {"_id": 0})
    return updated

@api_router.get("/shifts", response_model=List[Shift])
async def list_shifts(limit: int = 50):
    docs = await db.shifts.find({}, {"_id": 0}).sort("opened_at", -1).to_list(limit)
    return docs

@api_router.get("/shifts/{shift_id}")
async def get_shift(shift_id: str):
    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Shift not found")
    txns = await db.transactions.find({"shift_id": shift_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    expected = await compute_expected(shift_id, shift["opening_amount"])
    return {"shift": shift, "transactions": txns, "expected": expected}

# Transactions
@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(payload: TransactionCreate):
    shift = await get_open_shift()
    if not shift:
        raise HTTPException(400, "No open shift. Open a shift before recording transactions.")
    staff = await db.staff.find_one({"id": payload.staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(404, "Staff not found")
    if payload.amount <= 0 and payload.type != "ADJUSTMENT":
        raise HTTPException(400, "Amount must be positive for IN/OUT transactions.")
    receipt_no = await next_receipt_number()
    txn = Transaction(
        shift_id=shift["id"],
        type=payload.type,
        category=payload.category,
        amount=payload.amount,
        note=payload.note,
        staff_id=staff["id"],
        staff_name=staff["name"],
        drawer_opened=payload.drawer_opened,
        receipt_number=receipt_no,
    )
    await db.transactions.insert_one(txn.model_dump())
    return txn

@api_router.get("/transactions", response_model=List[Transaction])
async def list_transactions(shift_id: Optional[str] = None, limit: int = 200):
    q = {}
    if shift_id:
        q["shift_id"] = shift_id
    else:
        open_shift = await get_open_shift()
        if open_shift:
            q["shift_id"] = open_shift["id"]
    docs = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs

# Reports
@api_router.get("/reports/x")
async def x_report(shift_id: Optional[str] = None):
    """X-Report: snapshot of the currently open (or specified) shift without closing it."""
    shift = None
    if shift_id:
        shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    else:
        shift = await get_open_shift()
    if not shift:
        raise HTTPException(404, "Shift not found")
    txns = await db.transactions.find({"shift_id": shift["id"]}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    totals: Dict[str, float] = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    by_category: Dict[str, float] = {}
    for t in txns:
        totals[t["type"]] += t["amount"]
        key = f"{t['type']}:{t['category']}"
        by_category[key] = by_category.get(key, 0.0) + t["amount"]
    expected = shift["opening_amount"] + totals["IN"] - totals["OUT"] + totals["ADJUSTMENT"]
    return {
        "report_type": "X",
        "generated_at": now_iso(),
        "shift": shift,
        "totals": totals,
        "by_category": by_category,
        "transaction_count": len(txns),
        "expected_amount": expected,
        "transactions": txns,
    }

@api_router.get("/reports/z")
async def z_report(shift_id: str):
    """Z-Report: closed-shift final report."""
    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Shift not found")
    if shift["status"] != "CLOSED":
        raise HTTPException(400, "Z-Report requires a CLOSED shift.")
    txns = await db.transactions.find({"shift_id": shift_id}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    totals: Dict[str, float] = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    by_category: Dict[str, float] = {}
    for t in txns:
        totals[t["type"]] += t["amount"]
        key = f"{t['type']}:{t['category']}"
        by_category[key] = by_category.get(key, 0.0) + t["amount"]
    return {
        "report_type": "Z",
        "generated_at": now_iso(),
        "shift": shift,
        "totals": totals,
        "by_category": by_category,
        "transaction_count": len(txns),
        "transactions": txns,
    }

@api_router.get("/reports/daily")
async def daily_report(day: Optional[str] = None):
    """All shifts and transactions for a specific date (ISO date, e.g. 2026-02-14). Defaults to today (UTC)."""
    target = day or datetime.now(timezone.utc).date().isoformat()
    start = f"{target}T00:00:00+00:00"
    end = f"{target}T23:59:59+00:00"
    shifts = await db.shifts.find({"opened_at": {"$gte": start, "$lte": end}}, {"_id": 0}).sort("opened_at", 1).to_list(200)
    shift_ids = [s["id"] for s in shifts]
    txns = await db.transactions.find({"shift_id": {"$in": shift_ids}}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    totals = {"IN": 0.0, "OUT": 0.0, "ADJUSTMENT": 0.0}
    for t in txns:
        totals[t["type"]] += t["amount"]
    return {
        "date": target,
        "shift_count": len(shifts),
        "transaction_count": len(txns),
        "totals": totals,
        "shifts": shifts,
        "transactions": txns,
    }

# Meta
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
