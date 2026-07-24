import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DenominationGrid from "@/components/DenominationGrid";
import StaffPicker from "@/components/StaffPicker";
import { useStore } from "@/hooks/useStore";
import { api, EMPTY_DENOM, denomTotal } from "@/lib/api";
import { printer } from "@/lib/printer";
import { toast } from "sonner";

export default function ShiftOpenDialog({ open, onOpenChange }) {
  const { staff, refreshAll } = useStore();
  const [denoms, setDenoms] = useState({ ...EMPTY_DENOM });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [staffId, setStaffId] = useState("");

  useEffect(() => {
    if (open) {
      setDenoms({ ...EMPTY_DENOM });
      setNote("");
      setStaffId("");
    }
  }, [open]);

  const activeStaff = staff.find((s) => s.id === staffId) || null;

  const submit = async () => {
    if (!activeStaff) {
      toast.error("Select the user opening this shift.");
      return;
    }
    if (!printer.isConnected) {
      toast.error("Cash drawer is not connected. Pair it in Devices before opening a shift.");
      return;
    }
    setBusy(true);
    try {
      // Pulse the drawer FIRST — if the hardware fails, we don't record a fake shift
      await printer.openDrawer();
      await api.shifts.open({ staff_id: activeStaff.id, denominations: denoms, note });
      toast.success(`Shift opened by ${activeStaff.name}`);
      await refreshAll();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Failed to open shift");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="shift-open-dialog" className="max-w-lg bg-[#111827] border-border">
        <DialogHeader>
          <DialogTitle>Open Shift</DialogTitle>
          <DialogDescription>
            Count cash in the drawer and identify who is opening. Drawer will pulse open on confirm.
          </DialogDescription>
        </DialogHeader>
        <StaffPicker value={staffId} onChange={setStaffId} testid="open-staff" />
        <DenominationGrid value={denoms} onChange={setDenoms} testidPrefix="open-denom" />
        <Textarea
          data-testid="shift-open-note"
          placeholder="Optional note (e.g. till #2)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="bg-[#0B1120] border-border"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
          <Button
            data-testid="shift-open-confirm"
            onClick={submit}
            disabled={busy || !staffId || denomTotal(denoms) < 0}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-40"
          >
            {busy ? "Opening…" : "Confirm & Open Drawer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
