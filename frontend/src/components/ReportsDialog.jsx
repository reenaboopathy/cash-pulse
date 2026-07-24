import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, INR } from "@/lib/api";
import { toast } from "sonner";
import { Download, Printer as PrinterIcon } from "lucide-react";
import { printer } from "@/lib/printer";

export default function ReportsDialog({ open, onOpenChange }) {
  const [x, setX] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState("");
  const [z, setZ] = useState(null);
  const [tab, setTab] = useState("x");

  const loadX = async () => {
    try {
      const data = await api.reports.x();
      setX(data);
    } catch (e) {
      setX(null);
    }
  };

  const loadShifts = async () => {
    const list = await api.shifts.list();
    setShifts(list);
    const closed = list.find((s) => s.status === "CLOSED");
    if (closed) setSelectedShift(closed.id);
  };

  useEffect(() => {
    if (open) {
      loadX();
      loadShifts();
    }
  }, [open]);

  const loadZ = async (id) => {
    if (!id) return;
    try {
      const data = await api.reports.z(id);
      setZ(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load Z-report");
      setZ(null);
    }
  };

  useEffect(() => {
    if (selectedShift) loadZ(selectedShift);
  }, [selectedShift]);

  const exportCSV = (report) => {
    if (!report) return;
    const rows = [["timestamp", "type", "category", "amount", "staff", "note", "receipt"]];
    for (const t of report.transactions) {
      rows.push([t.created_at, t.type, t.category, t.amount, t.staff_name, (t.note || "").replace(/[\n,]/g, " "), t.receipt_number]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.report_type}-report-${report.shift.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPDF = () => {
    window.print();
  };

  const printThermal = async (report) => {
    if (!report) return;
    if (!printer.isConnected) {
      toast.error("Printer not connected. Open Devices.");
      return;
    }
    const s = report.shift;
    const lines = [
      `Report : ${report.report_type}-REPORT`,
      `Shift  : ${s.id.slice(0, 8)}`,
      `Opened : ${new Date(s.opened_at).toLocaleString("en-IN")}`,
      `By     : ${s.opened_by_name}`,
      ``,
      `IN     : INR ${report.totals.IN.toFixed(2)}`,
      `OUT    : INR ${report.totals.OUT.toFixed(2)}`,
      `ADJ    : INR ${report.totals.ADJUSTMENT.toFixed(2)}`,
      `Count  : ${report.transaction_count}`,
      ``,
      `Opening: INR ${s.opening_amount.toFixed(2)}`,
      s.expected_amount != null ? `Expect : INR ${s.expected_amount.toFixed(2)}` : `Expect : INR ${(report.expected_amount || 0).toFixed(2)}`,
      s.closing_amount != null ? `Counted: INR ${s.closing_amount.toFixed(2)}` : "",
      s.variance != null ? `Var.   : INR ${s.variance.toFixed(2)}` : "",
    ].filter(Boolean);
    await printer.printReceipt({ header: `${report.report_type}-REPORT`, lines, openDrawer: false });
    toast.success("Report printed.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="reports-dialog" className="bg-[#111827] border-border max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reports</DialogTitle>
          <DialogDescription>
            X-Report (current shift snapshot) &amp; Z-Report (closed shift final).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 bg-[#0f1725]">
            <TabsTrigger data-testid="tab-x" value="x">X-Report (Live)</TabsTrigger>
            <TabsTrigger data-testid="tab-z" value="z">Z-Report (Closed)</TabsTrigger>
          </TabsList>

          <TabsContent value="x" className="mt-3">
            {x?.shift ? (
              <ReportView report={x} onCSV={() => exportCSV(x)} onPDF={printPDF} onThermal={() => printThermal(x)} />
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">No open shift.</div>
            )}
          </TabsContent>

          <TabsContent value="z" className="mt-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Shift:</span>
              <select
                data-testid="z-shift-select"
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="bg-[#0B1120] border border-border rounded-md text-sm px-2 py-1"
              >
                <option value="">Choose a closed shift…</option>
                {shifts.filter((s) => s.status === "CLOSED").map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.opened_at).toLocaleString("en-IN")} · {s.opened_by_name}
                  </option>
                ))}
              </select>
            </div>
            {z ? (
              <ReportView report={z} onCSV={() => exportCSV(z)} onPDF={printPDF} onThermal={() => printThermal(z)} />
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">Select a closed shift.</div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportView({ report, onCSV, onPDF, onThermal }) {
  const s = report.shift;
  return (
    <div data-testid="report-view" className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Cell label="Opening" value={INR(s.opening_amount)} />
        <Cell label="Expected" value={INR(s.expected_amount ?? report.expected_amount ?? 0)} tone="text-white" />
        <Cell label="Counted" value={s.closing_amount != null ? INR(s.closing_amount) : "—"} />
        <Cell
          label="Variance"
          value={s.variance != null ? INR(s.variance) : "—"}
          tone={s.variance == null ? "text-slate-400" : s.variance === 0 ? "text-emerald-400" : s.variance > 0 ? "text-amber-400" : "text-rose-400"}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Cell label="IN" value={INR(report.totals.IN)} tone="text-emerald-400" />
        <Cell label="OUT" value={INR(report.totals.OUT)} tone="text-rose-400" />
        <Cell label="ADJ" value={INR(report.totals.ADJUSTMENT)} tone="text-amber-400" />
      </div>
      <div className="border border-border rounded-md max-h-64 overflow-y-auto thin-scroll">
        <table className="w-full text-xs font-mono">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0f1725] sticky top-0">
            <tr>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Staff</th>
              <th className="text-right px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {report.transactions.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-1.5">{new Date(t.created_at).toLocaleTimeString("en-IN")}</td>
                <td className="px-3 py-1.5">{t.type}</td>
                <td className="px-3 py-1.5">{t.category}</td>
                <td className="px-3 py-1.5">{t.staff_name}</td>
                <td className={`px-3 py-1.5 text-right ${t.type === "OUT" ? "text-rose-400" : t.type === "IN" ? "text-emerald-400" : "text-amber-400"}`}>
                  {INR(t.amount)}
                </td>
              </tr>
            ))}
            {report.transactions.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No transactions</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button data-testid="export-csv" onClick={onCSV} variant="outline" className="border-border">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
        <Button data-testid="export-pdf" onClick={onPDF} variant="outline" className="border-border">
          <PrinterIcon className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
        <Button data-testid="print-thermal" onClick={onThermal} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
          <PrinterIcon className="h-4 w-4 mr-2" /> Thermal Print
        </Button>
      </div>
    </div>
  );
}

function Cell({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-md border border-border p-3 bg-[#0f1725]">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`font-mono text-base mt-1 ${tone}`}>{value}</div>
    </div>
  );
}
