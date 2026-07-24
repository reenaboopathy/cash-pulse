import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DenominationGrid from "@/components/DenominationGrid";
import { useStore } from "@/hooks/useStore";
import { api, EMPTY_DENOM, denomTotal } from "@/lib/api";
import { printer } from "@/lib/printer";
import { toast } from "sonner";

export default function ShiftOpenDialog({ open, onOpenChange }) {
  const { activeStaff, refreshAll } = useStore();
  const [denoms, setDenoms] = useState({ ...EMPTY_DENOM });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!activeStaff) {
      toast.error("Select an active user first.");
      return;
    }
    setBusy(true);
    try {
      await api.shifts.open({ staff_id: activeStaff.id, denominations: denoms, note });
      // Pulse drawer on open
      try { if (printer.isConnected) await printer.openDrawer(); } catch (e) { /* ignore */ }
      toast.success(`Shift opened by ${activeStaff.name}`);
      await refreshAll();
      onOpenChange(false);
      setDenoms({ ...EMPTY_DENOM });
      setNote("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to open shift");
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
            Count cash in the drawer. Drawer will pulse open on confirm. User:{" "}
            <span className="text-amber-400 font-medium">{activeStaff?.name || "—"}</span>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
          <Button
            data-testid="shift-open-confirm"
            onClick={submit}
            disabled={busy || denomTotal(denoms) < 0}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            {busy ? "Opening…" : "Confirm & Open Drawer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
