import React, { useState } from "react";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { INR } from "@/lib/api";
import ShiftOpenDialog from "@/components/ShiftOpenDialog";
import ShiftCloseDialog from "@/components/ShiftCloseDialog";
import { LockOpen, LockKeyhole } from "lucide-react";

export default function ShiftControl() {
  const { shift, drawerConnected } = useStore();
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-[#111827] p-5 flex flex-col justify-between h-full">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Shift Control</div>
        <div className="text-lg font-semibold tracking-tight mt-1">
          {shift ? (
            <>
              Opened <span className="font-mono text-amber-400">{INR(shift.opening_amount)}</span> at{" "}
              <span className="font-mono text-muted-foreground">
                {new Date(shift.opened_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </>
          ) : (
            "No active shift"
          )}
        </div>
        {shift && (
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            #{shift.id.slice(0, 8)} · by {shift.opened_by_name}
          </div>
        )}
        {!drawerConnected && (
          <div className="text-xs text-amber-400/80 mt-2">
            Drawer offline — shift opens without a pulse. Cash actions stay locked until you connect the drawer.
          </div>
        )}
      </div>

      <div className="mt-4">
        {shift ? (
          <Button
            data-testid="close-shift-btn"
            className="w-full bg-rose-500 hover:bg-rose-400 text-white font-semibold"
            onClick={() => setCloseDlg(true)}
          >
            <LockKeyhole className="h-4 w-4 mr-2" />
            {drawerConnected ? "Close Shift & Pulse Drawer" : "Close Shift"}
          </Button>
        ) : (
          <Button
            data-testid="open-shift-btn"
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            onClick={() => setOpenDlg(true)}
          >
            <LockOpen className="h-4 w-4 mr-2" />
            {drawerConnected ? "Open Shift & Pulse Drawer" : "Open Shift"}
          </Button>
        )}
      </div>

      <ShiftOpenDialog open={openDlg} onOpenChange={setOpenDlg} />
      <ShiftCloseDialog open={closeDlg} onOpenChange={setCloseDlg} />
    </div>
  );
}
