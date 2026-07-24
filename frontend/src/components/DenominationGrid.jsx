import React, { useState } from "react";
import { DENOMS, denomTotal, INR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, RotateCcw } from "lucide-react";

/**
 * Denomination entry:
 * - Tap the note tile to add +1
 * - Small ± buttons to nudge
 * - Manual number input to type the count directly
 * - Reset button clears everything
 */
export default function DenominationGrid({ value, onChange, testidPrefix = "denom" }) {
  const [pulse, setPulse] = useState(null);
  const total = denomTotal(value);

  const setCount = (d, count) => {
    const key = `d${d}`;
    const next = Math.max(0, Number.isFinite(count) ? count : 0);
    onChange({ ...value, [key]: next });
    setPulse(d);
    setTimeout(() => setPulse((p) => (p === d ? null : p)), 180);
  };

  const bump = (d, delta) => setCount(d, (Number(value[`d${d}`]) || 0) + delta);

  const reset = () => {
    const cleared = DENOMS.reduce((a, d) => ({ ...a, [`d${d}`]: 0 }), {});
    onChange(cleared);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Tap a note to add · or type the count
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {DENOMS.map((d) => {
          const key = `d${d}`;
          const count = Number(value[key]) || 0;
          const line = count * d;
          const active = pulse === d;
          return (
            <div
              key={d}
              className={`rounded-lg border ${count > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-[#0f1725]"} transition-colors ${active ? "ring-2 ring-amber-500/60" : ""}`}
            >
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 p-2">
                {/* Tap-to-add note button */}
                <button
                  type="button"
                  data-testid={`${testidPrefix}-${d}`}
                  onClick={() => bump(d, 1)}
                  className={`h-12 w-14 rounded-md flex items-center justify-center text-lg font-bold font-mono transition-colors ${count > 0 ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-[#0B1120] text-slate-300 hover:bg-white/[0.06]"}`}
                >
                  ₹{d}
                </button>

                {/* Manual input */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      data-testid={`${testidPrefix}-${d}-minus`}
                      onClick={() => bump(d, -1)}
                      disabled={count === 0}
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-300 hover:bg-rose-500/10 disabled:opacity-30"
                      aria-label={`Remove one ₹${d}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      data-testid={`${testidPrefix}-${d}-input`}
                      type="number"
                      min="0"
                      value={count}
                      onChange={(e) => setCount(d, parseInt(e.target.value || "0", 10))}
                      onFocus={(e) => e.target.select()}
                      className="h-8 w-full bg-[#0B1120] border-border font-mono text-center text-base px-1"
                    />
                    <Button
                      type="button"
                      data-testid={`${testidPrefix}-${d}-plus`}
                      onClick={() => bump(d, 1)}
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-300 hover:bg-emerald-500/10"
                      aria-label={`Add one ₹${d}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Line total */}
                <div
                  className={`text-right font-mono text-xs whitespace-nowrap ${count > 0 ? "text-white" : "text-muted-foreground"}`}
                >
                  {INR(line)}
                </div>
              </div>
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
