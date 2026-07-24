import React, { useState } from "react";
import TopNav from "@/components/TopNav";
import BalanceCard from "@/components/BalanceCard";
import TransactionLog from "@/components/TransactionLog";
import QuickActions from "@/components/QuickActions";
import ShiftControl from "@/components/ShiftControl";
import SettingsDialog from "@/components/SettingsDialog";
import ReportsDialog from "@/components/ReportsDialog";
import StaffManagerDialog from "@/components/StaffManagerDialog";
import ReceiptPreview from "@/components/ReceiptPreview";
import { useStore } from "@/hooks/useStore";

export default function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const { shift } = useStore();

  return (
    <div className="min-h-screen text-foreground">
      <TopNav
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenReports={() => setReportsOpen(true)}
        onOpenStaff={() => setStaffOpen(true)}
      />

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: transactions */}
          <section className="lg:col-span-5 xl:col-span-5">
            <TransactionLog />
          </section>

          {/* Right: balance + actions */}
          <section className="lg:col-span-7 xl:col-span-7 space-y-6">
            <BalanceCard />
            <ShiftControl />
            <QuickActions onReceipt={setLastReceipt} disabled={!shift} />
            {lastReceipt && (
              <ReceiptPreview txn={lastReceipt.txn} shift={lastReceipt.shift} staffName={lastReceipt.staffName} balance={lastReceipt.balance} />
            )}
          </section>
        </div>
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ReportsDialog open={reportsOpen} onOpenChange={setReportsOpen} />
      <StaffManagerDialog open={staffOpen} onOpenChange={setStaffOpen} />
    </div>
  );
}
