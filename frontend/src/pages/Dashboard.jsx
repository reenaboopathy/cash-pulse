import React, { useState } from "react";
import TopNav from "@/components/TopNav";
import BalanceCard from "@/components/BalanceCard";
import TransactionLog from "@/components/TransactionLog";
import QuickActions from "@/components/QuickActions";
import ShiftControl from "@/components/ShiftControl";
import SettingsDialog from "@/components/SettingsDialog";
import ReportsDialog from "@/components/ReportsDialog";
import StaffManagerDialog from "@/components/StaffManagerDialog";
import BanksDialog from "@/components/BanksDialog";
import ReceiptPreview from "@/components/ReceiptPreview";
import { useStore } from "@/hooks/useStore";
import { Cable, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [banksOpen, setBanksOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const { shift, drawerConnected } = useStore();

  const cashDisabled = !shift || !drawerConnected;

  return (
    <div className="min-h-screen text-foreground">
      <TopNav
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenReports={() => setReportsOpen(true)}
        onOpenStaff={() => setStaffOpen(true)}
        onOpenBanks={() => setBanksOpen(true)}
      />

      <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-6">
        {!drawerConnected && (
          <div
            data-testid="disconnected-banner"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-4"
          >
            <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-300">Cash drawer not connected</div>
              <div className="text-xs text-muted-foreground mt-1">
                Cash transactions are locked. <b className="text-amber-300">UPI / Bank</b> transactions still work — they don&apos;t need the drawer.
              </div>
            </div>
            <Button
              data-testid="banner-connect-btn"
              onClick={() => setSettingsOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              <Cable className="h-4 w-4 mr-2" /> Connect Device
            </Button>
          </div>
        )}

        {/* Quick Actions TOP */}
        <QuickActions onReceipt={setLastReceipt} disabled={cashDisabled} />

        {/* Balance + Shift Control */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BalanceCard />
          <ShiftControl />
        </section>

        {lastReceipt && (
          <ReceiptPreview
            txn={lastReceipt.txn}
            shift={lastReceipt.shift}
            staffName={lastReceipt.staffName}
            balance={lastReceipt.balance}
          />
        )}

        {/* Transaction Feed BOTTOM */}
        <TransactionLog />
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ReportsDialog open={reportsOpen} onOpenChange={setReportsOpen} />
      <StaffManagerDialog open={staffOpen} onOpenChange={setStaffOpen} />
      <BanksDialog open={banksOpen} onOpenChange={setBanksOpen} />
    </div>
  );
}
