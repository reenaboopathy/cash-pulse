import React, { useState } from "react";
import { DENOMS, denomTotal, INR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Minus, RotateCcw } from "lucide-react";

/**
 * Click-to-add denomination entry.
 * Each denomination tile:  click = +1  ·  long-press / — button = -1  ·  reset button clears
 * A running total is shown at the bottom.
 */
export default function DenominationGrid({ value, onChange, testidPrefix = "denom" }) {
  const [pulse, setPulse] = useState(null);
  const total = denomTotal(value);

  const bump = (d, delta) => {
    const key = `d${d}`;
    const next = Math.max(0, (Number(value[key]) || 0) + delta);
    onChange({ ...value, [key]: next });
    setPulse(d);
    setTimeout(() => setPulse((p) => (p === d ? null : p)), 180);
  };

  const reset = () => {
    const cleared = DENOMS.reduce((a, d) => ({ ...a, [`d${d}`]: 0 }), {});
    onChange(cleared);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Tap a note to add · long-press to reduce
        </div>
        <Button
          data-testid={`${testidPrefix}-reset`}
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          className="text-muted-foreground hover:text-amber-400 h-7 px-2"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {DENOMS.map((d) => {
          const key = `d${d}`;
          const count = Number(value[key]) || 0;
          const line = count * d;
          const active = pulse === d;
          return (
            <div
              key={d}
              className={`relative rounded-lg border ${count > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-[#0f1725]"} transition-all overflow-hidden`}
            >
              <button
                type="button"
                data-testid={`${testidPrefix}-${d}`}
                onClick={() => bump(d, 1)}
                className={`w-full text-left px-3 py-3 hover:bg-white/[0.04] transition-colors ${active ? "ring-2 ring-amber-500/60" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-lg font-semibold ${count > 0 ? "text-amber-400" : "text-slate-300"}`}>₹{d}</span>
                  <span className={`font-mono text-sm ${count > 0 ? "text-white" : "text-muted-foreground"}`}>× {count}</span>
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {count > 0 ? `= ${INR(line)}` : "tap to add"}
                </div>
              </button>
              {count > 0 && (
                <button
                  type="button"
                  data-testid={`${testidPrefix}-${d}-minus`}
                  onClick={(e) => {
                    e.stopPropagation();
                    bump(d, -1);
                  }}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 flex items-center justify-center"
                  aria-label={`Remove one ₹${d}`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Cash total</span>
        <span data-testid={`${testidPrefix}-total`} className="font-mono text-2xl font-medium text-amber-400">
          {INR(total)}
        </span>
      </div>
    </div>
  );
}
