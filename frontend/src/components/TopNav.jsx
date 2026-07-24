import React from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/hooks/useStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings2, FileBarChart, Radio, Users, Landmark, ShieldCheck } from "lucide-react";

export default function TopNav({ onOpenSettings, onOpenReports, onOpenStaff, onOpenBanks }) {
  const { drawerConnected, drawerInfo } = useStore();
  const { admin } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[#0B1120]/85 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-6 py-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
            <img
              src="https://customer-assets-v7afamib.emergentagent.net/job_cash-pulse-16/artifacts/0pmr6wjy_DTF%20STICKER%20PRINTING%20%282%29.webp"
              alt="SelSolve"
              className="h-8 w-auto object-contain"
              data-testid="brand-logo"
            />
          </div>
          <div className="hidden sm:block border-l border-border pl-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
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

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button data-testid="banks-btn" variant="outline" size="sm" className="border-border bg-[#111827] hover:bg-[#1f2937]" onClick={onOpenBanks}>
            <Landmark className="h-4 w-4 mr-2" /> Banks
          </Button>
          <Button data-testid="reports-btn" variant="outline" size="sm" className="border-border bg-[#111827] hover:bg-[#1f2937]" onClick={onOpenReports}>
            <FileBarChart className="h-4 w-4 mr-2" /> Reports
          </Button>
          <Button data-testid="staff-btn" variant="outline" size="sm" className="border-border bg-[#111827] hover:bg-[#1f2937]" onClick={onOpenStaff}>
            <Users className="h-4 w-4 mr-2" /> Users
          </Button>
          <Button data-testid="settings-btn" variant="outline" size="sm" className="border-border bg-[#111827] hover:bg-[#1f2937]" onClick={onOpenSettings}>
            <Settings2 className="h-4 w-4 mr-2" /> Devices
          </Button>
          <Link to={admin ? "/admin" : "/login"}>
            <Button data-testid="admin-nav-btn" size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              <ShieldCheck className="h-4 w-4 mr-2" /> {admin ? "Admin" : "Admin Login"}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
