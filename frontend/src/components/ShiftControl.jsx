import React, { useState } from "react";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { INR } from "@/lib/api";
import ShiftOpenDialog from "@/components/ShiftOpenDialog";
import ShiftCloseDialog from "@/components/ShiftCloseDialog";
import { LockOpen, LockKeyhole } from "lucide-react";

export default function ShiftControl() {
  const { shift } = useStore();
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-[#111827] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Shift Control</div>
          <div className="text-lg font-semibold tracking-tight mt-1">
            {shift ? (
              <>Opened <span className="font-mono text-amber-400">{INR(shift.opening_amount)}</span> at{" "}
                <span className="font-mono text-muted-foreground">
                  {new Date(shift.opened_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            ) : (
              "No active shift"
            )}
          </div>
        </div>
        {shift ? (
          <Button
            data-testid="close-shift-btn"
            className="bg-rose-500 hover:bg-rose-400 text-white font-semibold"
            onClick={() => setCloseDlg(true)}
          >
            <LockKeyhole className="h-4 w-4 mr-2" /> Close Shift
          </Button>
        ) : (
          <Button
            data-testid="open-shift-btn"
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            onClick={() => setOpenDlg(true)}
          >
            <LockOpen className="h-4 w-4 mr-2" /> Open Shift
          </Button>
        )}
      </div>

      <ShiftOpenDialog open={openDlg} onOpenChange={setOpenDlg} />
      <ShiftCloseDialog open={closeDlg} onOpenChange={setCloseDlg} />
    </div>
  );
}
