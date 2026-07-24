import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Wrench, Smartphone } from "lucide-react";
import TransactionDialog from "@/components/TransactionDialog";
import { useStore } from "@/hooks/useStore";

export default function QuickActions({ onReceipt, disabled }) {
  const { shift, drawerConnected } = useStore();
  const [dialog, setDialog] = useState(null); // { type, defaultMethod }

  const cashDisabled = disabled;
  // UPI/Bank buttons only require a shift; not drawer.
  const digitalDisabled = !shift;

  return (
    <div className="rounded-lg border border-border bg-[#111827] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Quick Actions</div>
          <div className="text-lg font-semibold tracking-tight mt-1">Record a movement</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button
          data-testid="action-in"
          onClick={() => setDialog({ type: "IN", defaultMethod: "CASH" })}
          disabled={cashDisabled}
          className="h-24 flex-col gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          <ArrowDownRight className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-xs">Cash IN</span>
          <span className="text-[10px] text-emerald-400/80 font-normal">Sale · Top-up</span>
        </Button>
        <Button
          data-testid="action-out"
          onClick={() => setDialog({ type: "OUT", defaultMethod: "CASH" })}
          disabled={cashDisabled}
          className="h-24 flex-col gap-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
        >
          <ArrowUpRight className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-xs">Cash OUT</span>
          <span className="text-[10px] text-rose-400/80 font-normal">Expense · Refund</span>
        </Button>
        <Button
          data-testid="action-upi"
          onClick={() => setDialog({ type: "IN", defaultMethod: "UPI" })}
          disabled={digitalDisabled}
          className="h-24 flex-col gap-1 bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 disabled:opacity-40"
        >
          <Smartphone className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-xs">UPI / Bank</span>
          <span className="text-[10px] text-sky-400/80 font-normal">Sale &amp; Expense</span>
        </Button>
        <Button
          data-testid="action-adj"
          onClick={() => setDialog({ type: "ADJUSTMENT", defaultMethod: "CASH" })}
          disabled={cashDisabled}
          className="h-24 flex-col gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
        >
          <Wrench className="h-5 w-5" />
          <span className="font-bold uppercase tracking-wider text-xs">Adjustment</span>
          <span className="text-[10px] text-amber-400/80 font-normal">Correction (+/−)</span>
        </Button>
      </div>

      {(cashDisabled || digitalDisabled) && (
        <div data-testid="quick-actions-hint" className="mt-3 text-xs text-muted-foreground">
          {!shift ? "Open a shift to record any transaction." : !drawerConnected ? "Cash actions need the drawer. UPI/Bank still works without it." : ""}
        </div>
      )}

      <TransactionDialog
        type={dialog?.type || null}
        defaultMethod={dialog?.defaultMethod || "CASH"}
        onClose={() => setDialog(null)}
        onReceipt={onReceipt}
      />
    </div>
  );
}
