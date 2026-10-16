import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DenominationGrid from "@/components/DenominationGrid";
import StaffPicker from "@/components/StaffPicker";
import { useStore } from "@/hooks/useStore";
import { api, EMPTY_DENOM, denomTotal, apiErrorText } from "@/lib/api";
import { printer } from "@/lib/printer";
import { toast } from "sonner";
import { ArrowRight, LockOpen, Loader2 } from "lucide-react";

export default function ShiftOpenDialog({ open, onOpenChange }) {
  const { staff, refreshAll, drawerConnected } = useStore();
  const [step, setStep] = useState(1); // 1 = select user & pulse drawer, 2 = count cash
  const [staffId, setStaffId] = useState("");
  const [denoms, setDenoms] = useState({ ...EMPTY_DENOM });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const activeStaff = staff.find((s) => s.id === staffId) || null;

  useEffect(() => {
    if (open) {
      setStep(1);
      setStaffId("");
      setDenoms({ ...EMPTY_DENOM });
      setNote("");
      setBusy(false);
    }
  }, [open]);

  // Step 1 -> Step 2: pulse drawer (if connected) then advance
  const proceedToCount = async () => {
    if (!activeStaff) {
      toast.error("Select the user opening this shift.");
      return;
    }
    setBusy(true);
    try {
      if (printer.isConnected) {
        await printer.openDrawer();
        toast.success("Drawer opened — count the cash inside.");
      }
      setStep(2);
    } catch (e) {
      toast.error(e?.message || "Failed to open drawer");
    } finally {
      setBusy(false);
    }
  };

  // Step 2: save the shift
  const confirmOpen = async () => {
    setBusy(true);
    try {
      await api.shifts.open({ staff_id: activeStaff.id, denominations: denoms, note });
      toast.success(`Shift opened by ${activeStaff.name}`);
      await refreshAll();
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorText(e, "Failed to open shift"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="shift-open-dialog" className="max-w-lg bg-[#111827] border-border">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Open Shift — Step 1 of 2</DialogTitle>
              <DialogDescription>
                Who is opening the shift? On <b className="text-amber-300">Next</b>{" "}
                {drawerConnected ? "the cash drawer will pulse open so you can count the cash inside." : "you'll go straight to the count (drawer offline)."}
              </DialogDescription>
            </DialogHeader>
            <StaffPicker value={staffId} onChange={setStaffId} testid="open-staff" />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
                Cancel
              </Button>
              <Button
                data-testid="shift-open-next"
                onClick={proceedToCount}
                disabled={busy || !staffId}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-40"
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening drawer…</>
                ) : drawerConnected ? (
                  <><LockOpen className="h-4 w-4 mr-2" /> Next: Open Drawer</>
                ) : (
                  <>Next <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Open Shift — Step 2 of 2</DialogTitle>
              <DialogDescription>
                {drawerConnected
                  ? "Drawer is open. Count every note and enter the quantities below."
                  : "Enter the opening cash counts below."}{" "}
                By <span className="text-amber-400 font-medium">{activeStaff?.name}</span>
              </DialogDescription>
            </DialogHeader>
            <DenominationGrid value={denoms} onChange={setDenoms} testidPrefix="open-denom" />
            <Textarea
              data-testid="shift-open-note"
              placeholder="Optional note (e.g. till #2)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-[#0B1120] border-border"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} className="border-border">
                ← Back
              </Button>
              <Button
                data-testid="shift-open-confirm"
                onClick={confirmOpen}
                disabled={busy || denomTotal(denoms) < 0}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-40"
              >
                {busy ? "Opening…" : "Confirm & Open Shift"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
