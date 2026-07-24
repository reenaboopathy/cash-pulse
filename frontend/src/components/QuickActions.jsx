import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Wrench } from "lucide-react";
import TransactionDialog from "@/components/TransactionDialog";

export default function QuickActions({ onReceipt, disabled }) {
  const [type, setType] = useState(null);

  return (
    <div className="rounded-lg border border-border bg-[#111827] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Quick Actions</div>
          <div className="text-lg font-semibold tracking-tight mt-1">Record a movement</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
          data-testid="action-in"
          onClick={() => setType("IN")}
          disabled={disabled}
          className="h-20 flex-col gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          <ArrowDownRight className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-xs">Payment IN</span>
          <span className="text-[10px] text-emerald-400/80 font-normal">Sale · Top-up</span>
        </Button>
        <Button
          data-testid="action-out"
          onClick={() => setType("OUT")}
          disabled={disabled}
          className="h-20 flex-col gap-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
        >
          <ArrowUpRight className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-xs">Payment OUT</span>
          <span className="text-[10px] text-rose-400/80 font-normal">Expense · Refund · Payout</span>
        </Button>
        <Button
          data-testid="action-adj"
          onClick={() => setType("ADJUSTMENT")}
          disabled={disabled}
          className="h-20 flex-col gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
        >
          <Wrench className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-xs">Adjustment</span>
          <span className="text-[10px] text-amber-400/80 font-normal">Correction (+/−)</span>
        </Button>
      </div>
      {disabled && (
        <div className="mt-3 text-xs text-muted-foreground">Open a shift to record transactions.</div>
      )}

      <TransactionDialog type={type} onClose={() => setType(null)} onReceipt={onReceipt} />
    </div>
  );
}
