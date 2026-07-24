import React from "react";
import { DENOMS, denomTotal, INR } from "@/lib/api";
import { Input } from "@/components/ui/input";

export default function DenominationGrid({ value, onChange, testidPrefix = "denom" }) {
  const total = denomTotal(value);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {DENOMS.map((d) => {
          const key = `d${d}`;
          const count = Number(value[key]) || 0;
          const line = count * d;
          return (
            <label key={d} className="flex items-center gap-3 border border-border rounded-md px-3 py-2 bg-[#0f1725]">
              <span className="font-mono text-sm w-14 text-amber-400">₹{d}</span>
              <Input
                data-testid={`${testidPrefix}-${d}`}
                type="number"
                min="0"
                value={count}
                onChange={(e) => onChange({ ...value, [key]: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                className="h-8 bg-[#0B1120] border-border font-mono text-right"
              />
              <span className="font-mono text-xs text-muted-foreground w-24 text-right">
                = {INR(line)}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Cash total</span>
        <span data-testid={`${testidPrefix}-total`} className="font-mono text-2xl font-medium">{INR(total)}</span>
      </div>
    </div>
  );
}
