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
  const [tab, setTab] = useState("daily");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [daily, setDaily] = useState(null);
  const [staffRpt, setStaffRpt] = useState(null);
  const [expensesRpt, setExpensesRpt] = useState(null);

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
      loadDaily(day);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadDaily = async (d) => {
    try {
      const data = await api.reports.daily(d);
      setDaily(data);
    } catch (e) {
      setDaily(null);
      toast.error("Failed to load daily report");
    }
  };

  useEffect(() => {
    if (open) loadDaily(day);
    if (open && tab === "staff") loadStaff(day);
    if (open && tab === "expenses") loadExpenses(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, tab, open]);

  const loadStaff = async (d) => {
    try {
      const data = await api.reports.staff(d);
      setStaffRpt(data);
    } catch (e) {
      setStaffRpt(null);
      toast.error("Failed to load staff report");
    }
  };

  const loadExpenses = async (d) => {
    try {
      const data = await api.reports.expenses(d);
      setExpensesRpt(data);
    } catch (e) {
      setExpensesRpt(null);
      toast.error("Failed to load expenses report");
    }
  };

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

  const exportDailyCSV = () => {
    if (!daily) return;
    const rows = [["timestamp", "shift", "type", "category", "amount", "staff", "note", "receipt"]];
    for (const t of daily.transactions) {
      rows.push([t.created_at, t.shift_id.slice(0, 8), t.type, t.category, t.amount, t.staff_name, (t.note || "").replace(/[\n,]/g, " "), t.receipt_number]);
    }
    // Footer summary rows
    rows.push([]);
    rows.push(["", "", "", "TOTAL IN", daily.totals.IN]);
    rows.push(["", "", "", "TOTAL OUT", daily.totals.OUT]);
    rows.push(["", "", "", "TOTAL ADJ", daily.totals.ADJUSTMENT]);
    rows.push(["", "", "", "NET", daily.totals.IN - daily.totals.OUT + daily.totals.ADJUSTMENT]);
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-report-${daily.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printDailyThermal = async () => {
    if (!daily) return;
    if (!printer.isConnected) {
      toast.error("Printer not connected. Open Devices.");
      return;
    }
    const net = daily.totals.IN - daily.totals.OUT + daily.totals.ADJUSTMENT;
    const lines = [
      `Report : DAILY`,
      `Date   : ${daily.date}`,
      `Shifts : ${daily.shift_count}`,
      `Txns   : ${daily.transaction_count}`,
      ``,
      `IN     : INR ${daily.totals.IN.toFixed(2)}`,
      `OUT    : INR ${daily.totals.OUT.toFixed(2)}`,
      `ADJ    : INR ${daily.totals.ADJUSTMENT.toFixed(2)}`,
      `-------`,
      `NET    : INR ${net.toFixed(2)}`,
    ];
    await printer.printReceipt({ header: `DAILY REPORT`, lines, openDrawer: false });
    toast.success("Daily report printed.");
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
            <b>Daily</b> · final report for the whole day. <b>Staff</b> · per-user activity + breakdown by method. <b>Expenses</b> · every OUT transaction with categories, staff, and payment method. <b>X-Report</b> · live snapshot of the current shift. <b>Z-Report</b> · final closed-shift report.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 bg-[#0f1725]">
            <TabsTrigger data-testid="tab-daily" value="daily">Daily</TabsTrigger>
            <TabsTrigger data-testid="tab-staff" value="staff">Staff</TabsTrigger>
            <TabsTrigger data-testid="tab-expenses" value="expenses">Expenses</TabsTrigger>
            <TabsTrigger data-testid="tab-x" value="x">X-Report</TabsTrigger>
            <TabsTrigger data-testid="tab-z" value="z">Z-Report</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-3">
            <DailyReportView
              daily={daily}
              day={day}
              onDayChange={setDay}
              onCSV={exportDailyCSV}
              onPDF={printPDF}
              onThermal={printDailyThermal}
            />
          </TabsContent>

          <TabsContent value="staff" className="mt-3">
            <StaffReportView data={staffRpt} day={day} onDayChange={setDay} onPDF={printPDF} onCSV={() => exportStaffCSV(staffRpt)} />
          </TabsContent>

          <TabsContent value="expenses" className="mt-3">
            <ExpensesReportView data={expensesRpt} day={day} onDayChange={setDay} onPDF={printPDF} onCSV={() => exportExpensesCSV(expensesRpt)} />
          </TabsContent>

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


function DailyReportView({ daily, day, onDayChange, onCSV, onPDF, onThermal }) {
  const totals = daily?.totals || { IN: 0, OUT: 0, ADJUSTMENT: 0 };
  const net = totals.IN - totals.OUT + totals.ADJUSTMENT;
  const totalVariance = (daily?.shifts || []).reduce(
    (a, s) => a + (typeof s.variance === "number" ? s.variance : 0),
    0
  );

  return (
    <div data-testid="daily-view" className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Date</span>
        <input
          data-testid="daily-date"
          type="date"
          value={day}
          onChange={(e) => onDayChange(e.target.value)}
          className="bg-[#0B1120] border border-border rounded-md text-sm px-3 py-1.5 font-mono"
        />
        <div className="ml-auto text-xs text-muted-foreground font-mono">
          {daily ? `${daily.shift_count} shifts · ${daily.transaction_count} txns` : ""}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Cell label="Total IN" value={INR(totals.IN)} tone="text-emerald-400" />
        <Cell label="Total OUT" value={INR(totals.OUT)} tone="text-rose-400" />
        <Cell label="Adjustments" value={INR(totals.ADJUSTMENT)} tone="text-amber-400" />
        <Cell label="Net Movement" value={INR(net)} tone={net === 0 ? "text-white" : net > 0 ? "text-emerald-400" : "text-rose-400"} />
      </div>

      {/* Shifts summary */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="px-3 py-2 bg-[#0f1725] text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground border-b border-border">
          Shifts on {daily?.date || day}
        </div>
        <div className="max-h-40 overflow-y-auto thin-scroll">
          <table className="w-full text-xs font-mono">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0f1725] sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Opened</th>
                <th className="text-left px-3 py-2">By</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Opening</th>
                <th className="text-right px-3 py-2">Closing</th>
                <th className="text-right px-3 py-2">Variance</th>
              </tr>
            </thead>
            <tbody>
              {(daily?.shifts || []).map((s) => (
                <tr key={s.id} data-testid={`daily-shift-${s.id}`} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    {new Date(s.opened_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-1.5">{s.opened_by_name}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded ${s.status === "OPEN" ? "bg-amber-500/15 text-amber-400" : "bg-slate-500/15 text-slate-400"}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">{INR(s.opening_amount)}</td>
                  <td className="px-3 py-1.5 text-right">{s.closing_amount != null ? INR(s.closing_amount) : "—"}</td>
                  <td
                    className={`px-3 py-1.5 text-right ${s.variance == null ? "text-slate-400" : s.variance === 0 ? "text-emerald-400" : s.variance > 0 ? "text-amber-400" : "text-rose-400"}`}
                  >
                    {s.variance != null ? INR(s.variance) : "—"}
                  </td>
                </tr>
              ))}
              {(!daily || daily.shifts.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No shifts on this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {daily && daily.shifts.some((s) => s.variance != null) && (
          <div className="px-3 py-2 border-t border-border flex justify-end gap-6 text-xs font-mono bg-[#0f1725]">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Total variance</span>
            <span
              className={
                totalVariance === 0
                  ? "text-emerald-400"
                  : totalVariance > 0
                    ? "text-amber-400"
                    : "text-rose-400"
              }
            >
              {INR(totalVariance)}
            </span>
          </div>
        )}
      </div>

      {/* Transactions of the day */}
      <div className="border border-border rounded-md max-h-56 overflow-y-auto thin-scroll">
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
            {(daily?.transactions || []).map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-1.5">{new Date(t.created_at).toLocaleTimeString("en-IN")}</td>
                <td className="px-3 py-1.5">{t.type}</td>
                <td className="px-3 py-1.5">{t.category}</td>
                <td className="px-3 py-1.5">{t.staff_name}</td>
                <td
                  className={`px-3 py-1.5 text-right ${t.type === "OUT" ? "text-rose-400" : t.type === "IN" ? "text-emerald-400" : "text-amber-400"}`}
                >
                  {INR(t.amount)}
                </td>
              </tr>
            ))}
            {(!daily || daily.transactions.length === 0) && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No transactions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button data-testid="daily-export-csv" onClick={onCSV} variant="outline" className="border-border" disabled={!daily}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
        <Button data-testid="daily-export-pdf" onClick={onPDF} variant="outline" className="border-border" disabled={!daily}>
          <PrinterIcon className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
        <Button
          data-testid="daily-print-thermal"
          onClick={onThermal}
          disabled={!daily}
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
        >
          <PrinterIcon className="h-4 w-4 mr-2" /> Thermal Print
        </Button>
      </div>
    </div>
  );
}

function exportStaffCSV(data) {
  if (!data) return;
  const rows = [["staff", "shifts_opened", "shifts_closed", "txns", "IN", "OUT", "ADJ",
                 "cash_in", "cash_out", "upi_in", "upi_out", "bank_in", "bank_out"]];
  for (const s of data.staff) {
    rows.push([
      s.staff_name, s.shifts_opened, s.shifts_closed, s.transaction_count,
      s.totals.IN, s.totals.OUT, s.totals.ADJUSTMENT,
      s.by_method.CASH.IN, s.by_method.CASH.OUT,
      s.by_method.UPI.IN, s.by_method.UPI.OUT,
      s.by_method.BANK.IN, s.by_method.BANK.OUT,
    ]);
  }
  downloadCSV(rows, `staff-report-${data.date}.csv`);
}

function exportExpensesCSV(data) {
  if (!data) return;
  const rows = [["timestamp", "category", "amount", "method", "staff", "note"]];
  for (const t of data.transactions) {
    rows.push([t.created_at, t.category, t.amount, t.payment_method || "CASH", t.staff_name, (t.note || "").replace(/[\n,]/g, " ")]);
  }
  rows.push([]);
  rows.push(["", "TOTAL", data.total]);
  downloadCSV(rows, `expenses-${data.date}.csv`);
}

function downloadCSV(rows, filename) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "")}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StaffReportView({ data, day, onDayChange, onPDF, onCSV }) {
  const staffList = data?.staff || [];
  return (
    <div data-testid="staff-view" className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Date</span>
        <input
          data-testid="staff-date"
          type="date"
          value={day}
          onChange={(e) => onDayChange(e.target.value)}
          className="bg-[#0B1120] border border-border rounded-md text-sm px-3 py-1.5 font-mono"
        />
        <div className="ml-auto text-xs text-muted-foreground font-mono">
          {data ? `${data.staff_count} staff · ${data.shift_count} shifts · ${data.transaction_count} txns` : ""}
        </div>
      </div>

      {staffList.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          No activity for this date.
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto thin-scroll pr-1">
          {staffList.map((s) => (
            <div key={s.staff_id} data-testid={`staff-row-${s.staff_id}`} className="rounded-md border border-border bg-[#0f1725] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold">{s.staff_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                    Opened {s.shifts_opened} · Closed {s.shifts_closed} · {s.transaction_count} txns
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Net</div>
                  <div className={`font-mono text-lg ${s.totals.IN - s.totals.OUT + s.totals.ADJUSTMENT >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {INR(s.totals.IN - s.totals.OUT + s.totals.ADJUSTMENT)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <SmallCell label="IN" v={INR(s.totals.IN)} c="text-emerald-400" />
                <SmallCell label="OUT" v={INR(s.totals.OUT)} c="text-rose-400" />
                <SmallCell label="ADJ" v={INR(s.totals.ADJUSTMENT)} c="text-amber-400" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded border border-border p-2 bg-[#0B1120]">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">CASH</div>
                  <div className="font-mono text-xs mt-1">
                    <span className="text-emerald-400">+{INR(s.by_method.CASH.IN)}</span>{" "}
                    <span className="text-rose-400">−{INR(s.by_method.CASH.OUT)}</span>
                  </div>
                </div>
                <div className="rounded border border-border p-2 bg-[#0B1120]">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">UPI / BANK</div>
                  <div className="font-mono text-xs mt-1">
                    <span className="text-emerald-400">+{INR(s.by_method.UPI.IN + s.by_method.BANK.IN)}</span>{" "}
                    <span className="text-rose-400">−{INR(s.by_method.UPI.OUT + s.by_method.BANK.OUT)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button data-testid="staff-export-csv" onClick={onCSV} variant="outline" className="border-border" disabled={!data}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
        <Button data-testid="staff-export-pdf" onClick={onPDF} variant="outline" className="border-border" disabled={!data}>
          <PrinterIcon className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
      </div>
    </div>
  );
}

function ExpensesReportView({ data, day, onDayChange, onPDF, onCSV }) {
  return (
    <div data-testid="expenses-view" className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Date</span>
        <input
          data-testid="expenses-date"
          type="date"
          value={day}
          onChange={(e) => onDayChange(e.target.value)}
          className="bg-[#0B1120] border border-border rounded-md text-sm px-3 py-1.5 font-mono"
        />
        <div className="ml-auto text-xs text-muted-foreground font-mono">
          {data ? `${data.transaction_count} expenses` : ""}
        </div>
      </div>

      <div className="rounded-md border border-rose-500/40 bg-rose-500/5 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-rose-300">Total Expenses</div>
        <div data-testid="expenses-total" className="font-mono text-3xl font-medium text-white mt-1">
          {INR(data?.total || 0)}
        </div>
        <div className="mt-2 text-xs text-muted-foreground font-mono">
          CASH {INR(data?.by_method?.CASH || 0)} · UPI {INR(data?.by_method?.UPI || 0)} · BANK {INR(data?.by_method?.BANK || 0)}
        </div>
      </div>

      {data?.by_category?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">By Category</div>
          <div className="space-y-1">
            {data.by_category.map((c) => {
              const pct = data.total > 0 ? (c.amount / data.total) * 100 : 0;
              return (
                <div key={c.category} data-testid={`expense-cat-${c.category}`} className="rounded border border-border bg-[#0f1725] p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{c.category}</span>
                    <span className="font-mono text-rose-400">{INR(c.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-[#0B1120] rounded overflow-hidden">
                    <div className="h-full bg-rose-500/60" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data?.by_staff?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">By Staff</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.by_staff.map((s) => (
              <div key={s.staff_id} className="rounded border border-border bg-[#0f1725] px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{s.staff_name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{s.count} expenses</div>
                </div>
                <div className="font-mono text-rose-400 font-semibold">{INR(s.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.transactions?.length > 0 && (
        <div className="border border-border rounded-md max-h-64 overflow-y-auto thin-scroll">
          <table className="w-full text-xs font-mono">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0f1725] sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Method</th>
                <th className="text-left px-3 py-2">Staff</th>
                <th className="text-left px-3 py-2">Note</th>
                <th className="text-right px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-1.5">{new Date(t.created_at).toLocaleTimeString("en-IN")}</td>
                  <td className="px-3 py-1.5">{t.category}</td>
                  <td className="px-3 py-1.5">{t.payment_method || "CASH"}</td>
                  <td className="px-3 py-1.5">{t.staff_name}</td>
                  <td className="px-3 py-1.5 text-muted-foreground truncate">{t.note || "-"}</td>
                  <td className="px-3 py-1.5 text-right text-rose-400">{INR(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.transaction_count === 0 && (
        <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          No expenses recorded for this date.
        </div>
      )}

      <div className="flex gap-2">
        <Button data-testid="expenses-export-csv" onClick={onCSV} variant="outline" className="border-border" disabled={!data}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
        <Button data-testid="expenses-export-pdf" onClick={onPDF} variant="outline" className="border-border" disabled={!data}>
          <PrinterIcon className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
      </div>
    </div>
  );
}

function SmallCell({ label, v, c = "text-white" }) {
  return (
    <div className="rounded border border-border bg-[#0B1120] p-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm mt-0.5 ${c}`}>{v}</div>
    </div>
  );
}

