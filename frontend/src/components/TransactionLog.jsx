import React from "react";
import { useStore } from "@/hooks/useStore";
import { INR } from "@/lib/api";
import { ArrowDownRight, ArrowUpRight, Wrench, Receipt } from "lucide-react";

const typeMeta = {
  IN: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", Icon: ArrowDownRight, sign: "+" },
  OUT: { cls: "text-rose-400 bg-rose-500/10 border-rose-500/20", Icon: ArrowUpRight, sign: "-" },
  ADJUSTMENT: { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", Icon: Wrench, sign: "±" },
};

export default function TransactionLog() {
  const { transactions, shift } = useStore();

  return (
    <div data-testid="txn-log" className="rounded-lg border border-border bg-[#111827] h-full min-h-[560px] flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Transaction Feed
          </div>
          <div className="text-lg font-semibold tracking-tight mt-1">
            {shift ? `Live · ${transactions.length} entries` : "No open shift"}
          </div>
        </div>
        <Receipt className="h-5 w-5 text-muted-foreground" />
      </div>

      {transactions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          No transactions yet.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto thin-scroll">
          <ul className="divide-y divide-border">
            {transactions.map((t) => {
              const m = typeMeta[t.type] || typeMeta.IN;
              const { Icon } = m;
              const dt = new Date(t.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              return (
                <li key={t.id} data-testid={`txn-row-${t.id}`} className="grid grid-cols-[70px_1fr_auto] gap-3 items-center px-5 py-3 hover:bg-white/[0.03]">
                  <div className="font-mono text-xs text-muted-foreground">{dt}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${m.cls}`}>
                        <Icon className="h-3 w-3" /> {t.type}
                      </span>
                      <span className="text-sm font-medium truncate">{t.category}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      by <span className="text-foreground/80">{t.staff_name}</span>
                      {t.note ? <> · {t.note}</> : null}
                      {" · "}#<span className="font-mono">{String(t.receipt_number || 0).padStart(4, "0")}</span>
                    </div>
                  </div>
                  <div className={`font-mono text-sm font-semibold ${t.type === "OUT" ? "text-rose-400" : t.type === "IN" ? "text-emerald-400" : "text-amber-400"}`}>
                    {m.sign} {INR(t.amount)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
