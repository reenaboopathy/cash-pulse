import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { api, INR, apiErrorText } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Banknote, Smartphone, Landmark, LogOut, KeyRound, Eraser, TrendingUp, TrendingDown, Wrench, RefreshCw, Store } from "lucide-react";
import BanksDialog from "@/components/BanksDialog";
import ReportsDialog from "@/components/ReportsDialog";
import PinPrompt from "@/components/PinPrompt";
import ChangeCredentialsDialog from "@/components/ChangeCredentialsDialog";

export default function AdminDashboard() {
  const { admin, logout } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [banksOpen, setBanksOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  const load = async () => {
    try {
      const d = await api.admin.dashboard();
      setData(d);
    } catch (e) {
      toast.error(apiErrorText(e, "Failed to load dashboard"));
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const clearData = async (pin) => {
    try {
      const res = await api.admin.reset(pin, true);
      toast.success(`Cleared ${res.transactions_deleted} txns, ${res.shifts_deleted} shifts.`);
      await load();
    } catch (e) {
      toast.error(apiErrorText(e, "Reset failed"));
    }
  };

  if (!data) return <div className="p-8 text-muted-foreground">Loading admin dashboard…</div>;

  const methods = data.totals_by_method || { CASH: {}, UPI: {}, BANK: {} };
  const method = (m, t) => Number(methods?.[m]?.[t] || 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-[#0B1120]/85 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-6 py-4 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
              <img
                src="https://customer-assets-v7afamib.emergentagent.net/job_cash-pulse-16/artifacts/0pmr6wjy_DTF%20STICKER%20PRINTING%20%282%29.webp"
                alt="SelSolve"
                className="h-8 w-auto object-contain"
                data-testid="admin-logo"
              />
            </div>
            <div className="hidden sm:block border-l border-border pl-3">
              <div className="text-xl font-semibold tracking-tight leading-none">Admin Console</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400 mt-1">
                Live overview
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/" data-testid="admin-goto-register" className="text-xs text-muted-foreground hover:text-amber-400 flex items-center gap-1 mr-2">
              <Store className="h-3.5 w-3.5" /> Cash Register
            </Link>
            <Button data-testid="admin-refresh" onClick={load} variant="outline" size="sm" className="border-border">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
            <Button data-testid="admin-reports-btn" onClick={() => setReportsOpen(true)} variant="outline" size="sm" className="border-border">
              Reports
            </Button>
            <Button data-testid="admin-banks-btn" onClick={() => setBanksOpen(true)} variant="outline" size="sm" className="border-border">
              <Landmark className="h-3.5 w-3.5 mr-1" /> Banks
            </Button>
            <Button data-testid="admin-creds-btn" onClick={() => setCredsOpen(true)} variant="outline" size="sm" className="border-border">
              <KeyRound className="h-3.5 w-3.5 mr-1" /> Credentials
            </Button>
            <Button
              data-testid="admin-clear-btn"
              onClick={() => setPinOpen(true)}
              variant="outline"
              size="sm"
              className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
            >
              <Eraser className="h-3.5 w-3.5 mr-1" /> Clear Data
            </Button>
            <Button data-testid="admin-logout" onClick={() => { logout(); nav("/login"); }} variant="outline" size="sm" className="border-border">
              <LogOut className="h-3.5 w-3.5 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-6">
        <div className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-amber-400">{admin?.name}</span> ({admin?.mobile}) ·{" "}
          <span className="font-mono">{data.today}</span>
        </div>

        {/* Top row: Cash + UPI + Bank totals */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BigCard
            testid="card-cash"
            title="Cash in Drawer"
            value={INR(data.cash_balance)}
            icon={Banknote}
            tone="amber"
            sub={data.shift ? `Shift by ${data.shift.opened_by_name}` : "No open shift"}
          />
          <BigCard
            testid="card-upi"
            title="UPI Today (Net)"
            value={INR(method("UPI", "IN") - method("UPI", "OUT") + method("UPI", "ADJUSTMENT"))}
            icon={Smartphone}
            tone="emerald"
            sub={`IN ${INR(method("UPI", "IN"))} · OUT ${INR(method("UPI", "OUT"))}`}
          />
          <BigCard
            testid="card-bank-total"
            title="All Bank Balances"
            value={INR(data.bank_total)}
            icon={Landmark}
            tone="sky"
            sub={`${data.banks.length} account${data.banks.length === 1 ? "" : "s"}`}
          />
        </section>

        {/* Bank cards */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Bank Accounts</h2>
            <Button
              onClick={() => setBanksOpen(true)}
              data-testid="admin-manage-banks"
              variant="ghost"
              size="sm"
              className="text-amber-400 hover:text-amber-300"
            >
              Manage
            </Button>
          </div>
          {data.banks.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-[#111827] p-6 text-center text-sm text-muted-foreground">
              No banks yet. Click <b className="text-amber-400">Banks</b> to add one.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {data.banks.map((b) => (
                <div key={b.id} data-testid={`admin-bank-${b.id}`} className="rounded-md border border-border bg-[#111827] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{b.name}</span>
                    <Landmark className="h-4 w-4 text-slate-500" />
                  </div>
                  {b.account_number && (
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-mono">
                      {b.account_number}
                    </div>
                  )}
                  <div className={`mt-3 font-mono text-2xl ${b.current_balance < 0 ? "text-rose-400" : "text-white"}`}>
                    {INR(b.current_balance)}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                    Opening {INR(b.opening_balance)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Method breakdown */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Live Shift Totals</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {["CASH", "UPI", "BANK"].map((m) => (
              <div key={m} data-testid={`method-card-${m}`} className="rounded-md border border-border bg-[#111827] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{m}</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniStat label="IN" value={method(m, "IN")} tone="text-emerald-400" icon={TrendingUp} />
                  <MiniStat label="OUT" value={method(m, "OUT")} tone="text-rose-400" icon={TrendingDown} />
                  <MiniStat label="ADJ" value={method(m, "ADJUSTMENT")} tone="text-amber-400" icon={Wrench} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent transactions */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Transactions</h2>
          <div className="rounded-md border border-border bg-[#111827]">
            <div className="grid grid-cols-[100px_100px_1fr_100px_120px] gap-3 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <div>Time</div>
              <div>Method</div>
              <div>Category</div>
              <div>Staff</div>
              <div className="text-right">Amount</div>
            </div>
            {data.recent_transactions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No transactions in the current shift.</div>
            ) : (
              data.recent_transactions.map((t) => (
                <div
                  key={t.id}
                  data-testid={`admin-txn-${t.id}`}
                  className="grid grid-cols-[100px_100px_1fr_100px_120px] gap-3 px-4 py-2 border-t border-border font-mono text-xs items-center"
                >
                  <div className="text-muted-foreground">
                    {new Date(t.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className={t.payment_method === "CASH" ? "text-amber-400" : t.payment_method === "UPI" ? "text-emerald-400" : "text-sky-400"}>
                    {t.payment_method || "CASH"}
                  </div>
                  <div className="text-slate-200 truncate">
                    <span className={`mr-2 px-1.5 py-0.5 rounded ${t.type === "IN" ? "bg-emerald-500/15 text-emerald-400" : t.type === "OUT" ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-400"}`}>
                      {t.type}
                    </span>
                    {t.category}
                    {t.bank_name && <span className="text-muted-foreground"> · {t.bank_name}</span>}
                  </div>
                  <div className="text-muted-foreground truncate">{t.staff_name}</div>
                  <div className={`text-right ${t.type === "OUT" ? "text-rose-400" : t.type === "IN" ? "text-emerald-400" : "text-amber-400"}`}>
                    {INR(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <BanksDialog open={banksOpen} onOpenChange={setBanksOpen} />
      <ReportsDialog open={reportsOpen} onOpenChange={setReportsOpen} />
      <PinPrompt
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Confirm — Clear All Data"
        description="Enter your admin PIN to erase all transactions, shifts, and receipt counters. Staff and banks are preserved (bank balances reset to opening)."
        onSuccess={clearData}
      />
      <ChangeCredentialsDialog open={credsOpen} onOpenChange={setCredsOpen} />
    </div>
  );
}

function BigCard({ testid, title, value, icon: Icon, tone, sub }) {
  const cls = {
    amber: "border-amber-500/30 bg-amber-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    sky: "border-sky-500/30 bg-sky-500/5",
  }[tone];
  const iconCls = {
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    sky: "text-sky-400",
  }[tone];
  return (
    <div data-testid={testid} className={`rounded-lg border p-5 ${cls}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{title}</span>
        <Icon className={`h-5 w-5 ${iconCls}`} />
      </div>
      <div className="mt-3 font-mono text-3xl font-medium tracking-tight text-white">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone, icon: Icon }) {
  return (
    <div className="rounded border border-border bg-[#0f1725] p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`font-mono text-sm mt-0.5 ${tone}`}>{INR(value)}</div>
    </div>
  );
}
