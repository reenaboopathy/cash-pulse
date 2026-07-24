import React from "react";
import { useStore } from "@/hooks/useStore";
import { INR } from "@/lib/api";
import { ArrowDownRight, ArrowUpRight, Wrench } from "lucide-react";

export default function BalanceCard() {
  const { balance, totals, shift } = useStore();
  const open = !!shift;

  return (
    <div data-testid="balance-card" className="rounded-lg border border-border bg-[#111827] p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Live Drawer Balance
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span data-testid="balance-amount" className="font-mono font-medium tracking-tighter text-5xl sm:text-6xl text-white">
              {INR(balance)}
            </span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">INR</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium ${open ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"}`}>
              <span className={open ? "pulse-dot bg-amber-400" : "inline-block h-2 w-2 rounded-full bg-slate-500"} />
              {open ? "SHIFT OPEN" : "SHIFT CLOSED"}
            </span>
            {shift && (
              <span className="text-xs text-muted-foreground font-mono">
                #{shift.id.slice(0, 8)} · by {shift.opened_by_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Metric label="IN" value={totals.IN} tone="in" icon={<ArrowDownRight className="h-4 w-4" />} testid="total-in" />
        <Metric label="OUT" value={totals.OUT} tone="out" icon={<ArrowUpRight className="h-4 w-4" />} testid="total-out" />
        <Metric label="ADJ" value={totals.ADJUSTMENT} tone="adj" icon={<Wrench className="h-4 w-4" />} testid="total-adj" />
      </div>
    </div>
  );
}

function Metric({ label, value, tone, icon, testid }) {
  const toneCls = {
    in: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    out: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    adj: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  }[tone];
  return (
    <div data-testid={testid} className={`rounded-md border p-3 ${toneCls}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em]">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-mono text-lg font-medium">{INR(value)}</div>
    </div>
  );
}
