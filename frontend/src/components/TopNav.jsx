import React from "react";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Settings2, FileBarChart, Radio, Users } from "lucide-react";

export default function TopNav({ onOpenSettings, onOpenReports, onOpenStaff }) {
  const { drawerConnected, drawerInfo } = useStore();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[#0B1120]/85 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-6 py-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-amber-500 flex items-center justify-center">
            <span className="font-mono text-black font-bold text-lg leading-none">S</span>
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight leading-none">SELTRACK</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mt-1">
              Cash Register
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 border border-border rounded-md">
          <Radio className={`h-3.5 w-3.5 ${drawerConnected ? "text-emerald-400" : "text-slate-500"}`} />
          <span className="text-xs uppercase tracking-wider font-medium">
            {drawerConnected ? `Drawer: ${drawerInfo?.mode?.toUpperCase() || "READY"}` : "Drawer: OFFLINE"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Button
            data-testid="reports-btn"
            variant="outline"
            className="border-border bg-[#111827] hover:bg-[#1f2937]"
            onClick={onOpenReports}
          >
            <FileBarChart className="h-4 w-4 mr-2" /> Reports
          </Button>
          <Button
            data-testid="staff-btn"
            variant="outline"
            className="border-border bg-[#111827] hover:bg-[#1f2937]"
            onClick={onOpenStaff}
          >
            <Users className="h-4 w-4 mr-2" /> Users
          </Button>
          <Button
            data-testid="settings-btn"
            variant="outline"
            className="border-border bg-[#111827] hover:bg-[#1f2937]"
            onClick={onOpenSettings}
          >
            <Settings2 className="h-4 w-4 mr-2" /> Devices
          </Button>
        </div>
      </div>
    </header>
  );
}
