import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, INR, apiErrorText } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, Plus, Landmark } from "lucide-react";
import { useStore } from "@/hooks/useStore";

export default function BanksDialog({ open, onOpenChange }) {
  const { refreshBanks } = useStore();
  const [banks, setBanks] = useState([]);
  const [name, setName] = useState("");
  const [acct, setAcct] = useState("");
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const list = await api.banks.list();
    setBanks(list);
  };

  useEffect(() => {
    if (open) {
      load();
      setName("");
      setAcct("");
      setOpening("");
    }
  }, [open]);

  const add = async () => {
    if (!name.trim()) return toast.error("Bank name required");
    setBusy(true);
    try {
      await api.banks.create({
        name: name.trim(),
        account_number: acct.trim() || null,
        opening_balance: Number(opening) || 0,
      });
      await load();
      await refreshBanks();
      setName("");
      setAcct("");
      setOpening("");
      toast.success(`${name} added`);
    } catch (e) {
      toast.error(apiErrorText(e, "Failed to add bank"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id, bname) => {
    if (!window.confirm(`Deactivate ${bname}? Its ledger is preserved.`)) return;
    try {
      await api.banks.remove(id);
      await load();
      await refreshBanks();
      toast.success(`${bname} removed`);
    } catch (e) {
      toast.error(apiErrorText(e, "Failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="banks-dialog" className="bg-[#111827] border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-400" /> Banks &amp; UPI Accounts
          </DialogTitle>
          <DialogDescription>
            Create banks / UPI accounts with an opening balance. Every UPI or Bank transaction adjusts the current balance live.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border p-4 bg-[#0f1725] space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Add new</div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] gap-2">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Name</Label>
              <Input
                data-testid="bank-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HDFC Current / GPay UPI"
                className="bg-[#0B1120] border-border"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Account / UPI ID</Label>
              <Input
                data-testid="bank-acct"
                value={acct}
                onChange={(e) => setAcct(e.target.value)}
                placeholder="Optional"
                className="bg-[#0B1120] border-border"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Opening bal (₹)</Label>
              <Input
                data-testid="bank-opening"
                type="number"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                placeholder="0"
                className="bg-[#0B1120] border-border font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button
                data-testid="bank-add-btn"
                onClick={add}
                disabled={busy}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border max-h-72 overflow-y-auto thin-scroll">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0f1725] sticky top-0">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Account</th>
                <th className="text-right px-4 py-2">Opening</th>
                <th className="text-right px-4 py-2">Current</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id} data-testid={`bank-row-${b.id}`} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{b.name}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{b.account_number || "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">{INR(b.opening_balance)}</td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold ${b.current_balance < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {INR(b.current_balance)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      data-testid={`bank-remove-${b.id}`}
                      onClick={() => remove(b.id, b.name)}
                      size="sm"
                      variant="outline"
                      className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
              {banks.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No banks yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
