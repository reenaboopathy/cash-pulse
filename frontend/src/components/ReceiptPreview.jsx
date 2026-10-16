import React from "react";
import { INR } from "@/lib/api";

export default function ReceiptPreview({ txn, shift, staffName, balance }) {
  if (!txn) return null;
  const dt = new Date(txn.created_at || Date.now()).toLocaleString("en-IN");
  const sign = txn.type === "OUT" ? "-" : txn.type === "IN" ? "+" : "±";
  return (
    <div data-testid="receipt-preview" className="rounded-md p-6 receipt-paper border border-dashed border-black/20">
      <div className="text-center">
        <div className="text-xl font-bold tracking-widest">SELTRACK</div>
        <div className="text-xs uppercase tracking-wider">Cash Receipt</div>
      </div>
      <div className="border-t border-dashed border-black/40 my-3" />
      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap m-0 font-mono">
{`Receipt #${String(txn.receipt_number || 0).padStart(6, "0")}
Date   : ${dt}
Staff  : ${staffName || txn.staff_name}
Type   : ${txn.type}
Cat.   : ${txn.category}

Amount : ${sign} ${INR(txn.amount)}
Note   : ${txn.note || "-"}

Shift  : ${shift?.id?.slice(0, 8) || "-"}
Balance: ${INR(balance)}`}
      </pre>
      <div className="border-t border-dashed border-black/40 my-3" />
      <div className="text-center text-xs uppercase tracking-widest">Thank you</div>
    </div>
  );
}
