import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useStore } from "@/hooks/useStore";
import { api, apiErrorText, INR } from "@/lib/api";
import { printer, buildReceiptLines } from "@/lib/printer";
import { toast } from "sonner";
import StaffPicker from "@/components/StaffPicker";
import CategoryPicker from "@/components/CategoryPicker";
import { Banknote, Smartphone } from "lucide-react";

const METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI / Bank", icon: Smartphone },
];

export default function TransactionDialog({ type, defaultMethod = "CASH", onClose, onReceipt }) {
  const { staff, refreshAll, shift, balance, banks, refreshBanks } = useStore();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [printReceipt, setPrintReceipt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [method, setMethod] = useState(defaultMethod);
  const [bankId, setBankId] = useState("");

  const open = !!type;
  const activeStaff = staff.find((s) => s.id === staffId) || null;
  const isCash = method === "CASH";
  const requiresBank = method === "UPI" || method === "BANK";

  useEffect(() => {
    if (type) {
      setAmount("");
      setNote("");
      setCategory("");
      setStaffId("");
      setMethod(defaultMethod);
      setBankId("");
    }
  }, [type, defaultMethod]);

  useEffect(() => {
    if (open && requiresBank) refreshBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method]);

  const submit = async () => {
    if (!activeStaff) return toast.error("Select the user performing this transaction.");
    if (!shift) return toast.error("Open a shift first.");
    if (!category) return toast.error("Select a reason / category.");
    const amt = Number(amount);
    if (!(amt > 0) && type !== "ADJUSTMENT") return toast.error("Enter a positive amount.");
    if (type === "ADJUSTMENT" && !amt) return toast.error("Enter a non-zero adjustment amount.");
    if (requiresBank && !bankId) return toast.error("Select the bank / UPI account.");
    if (isCash && !printer.isConnected) {
      return toast.error("Cash drawer not connected. Pair it in Devices or switch to UPI/Bank.");
    }
    setBusy(true);
    // Idempotency key generated at click time — a network retry re-uses this key so the server dedupes.
    const clientId =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      if (isCash) {
        // 1) OPEN THE DRAWER FIRST so the cashier can accept/hand out cash immediately
        await printer.openDrawer();
        // 2) THEN print the receipt (without a second pulse)
        if (printReceipt) {
          await printer.printReceipt({
            header: `${type} · ${category}`,
            lines: buildReceiptLines({
              txn: { type, category, amount: amt, note, receipt_number: 0, created_at: new Date().toISOString() },
              shift,
              staffName: activeStaff.name,
              balance: balance + (type === "IN" ? amt : type === "OUT" ? -amt : amt),
            }),
            openDrawer: false,
          });
        }
      }
      const txn = await api.transactions.create({
        type,
        category,
        amount: amt,
        note,
        staff_id: activeStaff.id,
        payment_method: method,
        bank_id: requiresBank ? bankId : null,
        drawer_opened: isCash,
        client_id: clientId,
      });
      await refreshAll();
      if (requiresBank) await refreshBanks();
      onReceipt?.({
        txn,
        shift,
        staffName: activeStaff.name,
        balance: isCash ? balance + (type === "IN" ? amt : type === "OUT" ? -amt : amt) : balance,
      });
      toast.success(`${type} recorded · ${method} · #${String(txn.receipt_number).padStart(4, "0")}`);
      onClose();
    } catch (e) {
      toast.error(apiErrorText(e, "Failed to record transaction"));
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = !busy && staffId && category && amount && (!requiresBank || bankId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="txn-dialog" className="bg-[#111827] border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">
            Record {type === "IN" ? "Payment IN" : type === "OUT" ? "Payment OUT" : "Adjustment"}
          </DialogTitle>
          <DialogDescription>
            Choose payment method — cash pulses the drawer, UPI/Bank posts to the selected bank ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <StaffPicker value={staffId} onChange={setStaffId} testid="txn-staff" />

          {/* Payment method */}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Payment method</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`method-${value.toLowerCase()}`}
                  onClick={() => setMethod(value)}
                  className={`rounded-md border py-2 px-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    method === value
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                      : "border-border bg-[#0B1120] text-slate-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {requiresBank && (
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">UPI / Bank account</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger data-testid="txn-bank" className="bg-[#0B1120] border-border mt-1">
                  <SelectValue placeholder="Select bank / UPI…" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id} data-testid={`txn-bank-opt-${b.id}`}>
                      <span className="font-medium">{b.name}</span>
                      <span className="text-muted-foreground ml-2 font-mono">{INR(b.current_balance)}</span>
                    </SelectItem>
                  ))}
                  {banks.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No banks yet — an admin must add one.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <CategoryPicker category={type} value={category} onChange={setCategory} testid="txn-category" />

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Amount (INR){type === "ADJUSTMENT" ? " — negative = missing" : ""}
            </Label>
            <Input
              data-testid="txn-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-[#0B1120] border-border font-mono text-xl h-12 mt-1"
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

          {isCash && (
            <div className="flex items-center gap-3 pt-1">
              <Switch data-testid="txn-print" checked={printReceipt} onCheckedChange={setPrintReceipt} />
              <span className="text-sm">Print receipt on confirm</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button
            data-testid="txn-confirm"
            onClick={submit}
            disabled={!canConfirm}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-40"
          >
            {busy ? "Recording…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
