import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useStore } from "@/hooks/useStore";
import { api } from "@/lib/api";
import { printer, buildReceiptLines } from "@/lib/printer";
import { toast } from "sonner";
import StaffPicker from "@/components/StaffPicker";

const CATEGORIES = {
  IN: ["Cash Sale", "Deposit / Top-up", "Loan Repayment", "Other Income"],
  OUT: ["Expense", "Vendor Payment", "Refund", "Payout / Withdrawal", "Other Expense"],
  ADJUSTMENT: ["Cash Found", "Cash Missing", "Correction", "Manager Note"],
};

export default function TransactionDialog({ type, onClose, onReceipt }) {
  const { staff, refreshAll, shift, balance } = useStore();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [printReceipt, setPrintReceipt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [staffId, setStaffId] = useState("");

  useEffect(() => {
    if (type) {
      setAmount("");
      setNote("");
      setCategory(CATEGORIES[type]?.[0] || "");
      setStaffId(""); // mandatory re-select each time
    }
  }, [type]);

  const open = !!type;
  const activeStaff = staff.find((s) => s.id === staffId) || null;

  const submit = async () => {
    if (!activeStaff) {
      toast.error("Select the user performing this transaction.");
      return;
    }
    if (!shift) {
      toast.error("Open a shift first.");
      return;
    }
    const amt = Number(amount);
    if (!(amt > 0) && type !== "ADJUSTMENT") {
      toast.error("Enter a positive amount.");
      return;
    }
    if (type === "ADJUSTMENT" && !amt) {
      toast.error("Enter a non-zero adjustment amount (use negative for missing cash).");
      return;
    }
    if (!printer.isConnected) {
      toast.error("Cash drawer is not connected. Pair it in Devices before recording transactions.");
      return;
    }
    setBusy(true);
    try {
      // Pulse the drawer + print receipt FIRST — if the hardware fails, we don't record a phantom transaction
      if (printReceipt) {
        await printer.printReceipt({
          header: `${type} · ${category}`,
          lines: buildReceiptLines({
            txn: { type, category, amount: amt, note, receipt_number: 0, created_at: new Date().toISOString() },
            shift,
            staffName: activeStaff.name,
            balance: balance + (type === "IN" ? amt : type === "OUT" ? -amt : amt),
          }),
          openDrawer: true,
        });
      } else {
        await printer.openDrawer();
      }

      const txn = await api.transactions.create({
        type,
        category,
        amount: amt,
        note,
        staff_id: activeStaff.id,
        drawer_opened: true,
      });
      await refreshAll();
      onReceipt?.({ txn, shift, staffName: activeStaff.name, balance: balance + (type === "IN" ? amt : type === "OUT" ? -amt : amt) });
      toast.success(`${type} recorded · #${String(txn.receipt_number).padStart(4, "0")}`);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Failed to record transaction");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="txn-dialog" className="bg-[#111827] border-border">
        <DialogHeader>
          <DialogTitle className="capitalize">
            Record {type === "IN" ? "Payment IN" : type === "OUT" ? "Payment OUT" : "Adjustment"}
          </DialogTitle>
          <DialogDescription>
            Confirm who is performing this action — the drawer will pulse open on confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <StaffPicker value={staffId} onChange={setStaffId} testid="txn-staff" />

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="txn-category" className="bg-[#0B1120] border-border mt-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {(CATEGORIES[type] || []).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Amount (INR){type === "ADJUSTMENT" ? " — negative = missing cash" : ""}
            </Label>
            <Input
              data-testid="txn-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-[#0B1120] border-border font-mono text-xl h-12 mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Note</Label>
            <Textarea
              data-testid="txn-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional description"
              className="bg-[#0B1120] border-border mt-1"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch data-testid="txn-print" checked={printReceipt} onCheckedChange={setPrintReceipt} />
            <span className="text-sm">Print receipt on confirm</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button
            data-testid="txn-confirm"
            onClick={submit}
            disabled={busy || !staffId}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-40"
          >
            {busy ? "Recording…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
