import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DenominationGrid from "@/components/DenominationGrid";
import StaffPicker from "@/components/StaffPicker";
import { useStore } from "@/hooks/useStore";
import { api, EMPTY_DENOM, denomTotal, INR, apiErrorText } from "@/lib/api";
import { printer } from "@/lib/printer";
import { toast } from "sonner";
import { ArrowRight, LockKeyhole, Loader2 } from "lucide-react";

export default function ShiftCloseDialog({ open, onOpenChange }) {
  const { staff, refreshAll, balance, shift, drawerConnected } = useStore();
  const [step, setStep] = useState(1);
  const [staffId, setStaffId] = useState("");
  const [denoms, setDenoms] = useState({ ...EMPTY_DENOM });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const activeStaff = staff.find((s) => s.id === staffId) || null;
  const counted = denomTotal(denoms);
  const variance = counted - balance;

  useEffect(() => {
    if (open) {
      setStep(1);
      setStaffId("");
      setDenoms({ ...EMPTY_DENOM });
      setNote("");
      setBusy(false);
    }
  }, [open]);

  const proceedToCount = async () => {
    if (!activeStaff) {
      toast.error("Select the user closing this shift.");
      return;
    }
    setBusy(true);
    try {
      if (printer.isConnected) {
        await printer.openDrawer();
        toast.success("Drawer opened — count the remaining cash.");
      }
      setStep(2);
    } catch (e) {
      toast.error(e?.message || "Failed to open drawer");
    } finally {
      setBusy(false);
    }
  };

  const confirmClose = async () => {
    setBusy(true);
    try {
      const closed = await api.shifts.close({ staff_id: activeStaff.id, denominations: denoms, note });
      if (printer.isConnected) {
        try {
          await printer.printReceipt({
            header: "Z-REPORT / SHIFT CLOSE",
            lines: [
              `Shift  : ${closed.id.slice(0, 8)}`,
              `Opened : ${new Date(closed.opened_at).toLocaleString("en-IN")}`,
              `Closed : ${new Date(closed.closed_at).toLocaleString("en-IN")}`,
              `By     : ${closed.closed_by_name}`,
              ``,
              `Opening: INR ${closed.opening_amount.toFixed(2)}`,
              `Expect : INR ${closed.expected_amount.toFixed(2)}`,
              `Counted: INR ${closed.closing_amount.toFixed(2)}`,
              `Var.   : INR ${closed.variance.toFixed(2)}`,
            ],
            openDrawer: false,
          });
        } catch (_) {
          toast.warning("Shift closed, but receipt failed to print.");
        }
      }
      toast.success(`Shift closed. Variance ${INR(closed.variance)}`);
      await refreshAll();
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorText(e, "Failed to close shift"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="shift-close-dialog" className="max-w-lg bg-[#111827] border-border">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Close Shift — Step 1 of 2</DialogTitle>
              <DialogDescription>
                Who is closing the shift? On <b className="text-amber-300">Next</b>{" "}
                {drawerConnected ? "the cash drawer will pulse open so you can count the remaining cash." : "you'll go straight to the count (drawer offline)."}
              </DialogDescription>
            </DialogHeader>
            <StaffPicker value={staffId} onChange={setStaffId} testid="close-staff" />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
                Cancel
              </Button>
              <Button
                data-testid="shift-close-next"
                onClick={proceedToCount}
                disabled={busy || !staffId || !shift}
                className="bg-rose-500 hover:bg-rose-400 text-white font-semibold disabled:opacity-40"
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening drawer…</>
                ) : drawerConnected ? (
                  <><LockKeyhole className="h-4 w-4 mr-2" /> Next: Open Drawer</>
                ) : (
                  <>Next <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Close Shift — Step 2 of 2</DialogTitle>
              <DialogDescription>
                {drawerConnected
                  ? "Drawer is open. Count every note in the drawer now."
                  : "Enter the closing cash counts below."}{" "}
                By <span className="text-amber-400 font-medium">{activeStaff?.name}</span>
              </DialogDescription>
            </DialogHeader>
            <DenominationGrid value={denoms} onChange={setDenoms} testidPrefix="close-denom" />

            <div className="grid grid-cols-3 gap-3 mt-2">
              <SumCell label="Expected" value={balance} tone="text-slate-200" />
              <SumCell label="Counted" value={counted} tone="text-white" />
              <SumCell
                label="Variance"
                value={variance}
                tone={variance === 0 ? "text-emerald-400" : variance > 0 ? "text-amber-400" : "text-rose-400"}
                testid="close-variance"
              />
            </div>

            <Textarea
              data-testid="shift-close-note"
              placeholder="Reason for variance (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0B1120] border-border"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} className="border-border">
                ← Back
              </Button>
              <Button
                data-testid="shift-close-confirm"
                onClick={confirmClose}
                disabled={busy || !shift}
                className="bg-rose-500 hover:bg-rose-400 text-white font-semibold disabled:opacity-40"
              >
                {busy ? "Closing…" : "Confirm & Close Shift"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SumCell({ label, value, tone, testid }) {
  return (
    <div className="rounded-md border border-border p-3 bg-[#0f1725]">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div data-testid={testid} className={`font-mono text-lg font-medium mt-1 ${tone}`}>{INR(value)}</div>
    </div>
  );
}
