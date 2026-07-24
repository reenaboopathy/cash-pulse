import React, { useState } from "react";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { INR } from "@/lib/api";
import ShiftOpenDialog from "@/components/ShiftOpenDialog";
import ShiftCloseDialog from "@/components/ShiftCloseDialog";
import { LockOpen, LockKeyhole, Cable } from "lucide-react";
import { toast } from "sonner";

export default function ShiftControl() {
  const { shift, drawerConnected } = useStore();
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);

  const guard = () => {
    if (!drawerConnected) {
      toast.error("Connect the cash drawer first. Open Devices → Web Serial / WebUSB.");
      return false;
    }
    return true;
  };

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
      </div>

      <div className="mt-4">
        {shift ? (
          <Button
            data-testid="close-shift-btn"
            className="w-full bg-rose-500 hover:bg-rose-400 text-white font-semibold disabled:opacity-40"
            onClick={() => guard() && setCloseDlg(true)}
            disabled={!drawerConnected}
          >
            {drawerConnected ? (
              <><LockKeyhole className="h-4 w-4 mr-2" /> Close Shift &amp; Pulse Drawer</>
            ) : (
              <><Cable className="h-4 w-4 mr-2" /> Connect drawer to close</>
            )}
          </Button>
        ) : (
          <Button
            data-testid="open-shift-btn"
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-40"
            onClick={() => guard() && setOpenDlg(true)}
            disabled={!drawerConnected}
          >
            {drawerConnected ? (
              <><LockOpen className="h-4 w-4 mr-2" /> Open Shift &amp; Pulse Drawer</>
            ) : (
              <><Cable className="h-4 w-4 mr-2" /> Connect drawer to open</>
            )}
          </Button>
        )}
      </div>

      <ShiftOpenDialog open={openDlg} onOpenChange={setOpenDlg} />
      <ShiftCloseDialog open={closeDlg} onOpenChange={setCloseDlg} />
    </div>
  );
}
