import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/hooks/useStore";
import { toast } from "sonner";

const ROLES = ["Manager", "Cashier", "Supervisor", "Owner"];

export default function StaffManagerDialog({ open, onOpenChange }) {
  const { staff, refreshStaff } = useStore();
  const [name, setName] = useState("");
  const [role, setRole] = useState("Cashier");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setRole("Cashier");
    }
  }, [open]);

  const add = async () => {
    const n = name.trim();
    if (!n) {
      toast.error("Enter a name");
      return;
    }
    setBusy(true);
    try {
      await api.staff.create({ name: n, role });
      await refreshStaff();
      setName("");
      toast.success(`${n} added`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to add staff");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id, sname) => {
    if (!window.confirm(`Remove ${sname}? This will deactivate them.`)) return;
    try {
      await api.staff.remove(id);
      await refreshStaff();
      toast.success(`${sname} removed`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="staff-dialog" className="bg-[#111827] border-border max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Users</DialogTitle>
          <DialogDescription>
            Add or remove staff who can operate the cash register. Every drawer action is tagged with the active user.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border p-4 bg-[#0f1725]">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">Add new user</div>
          <div className="grid grid-cols-[1fr_140px_auto] gap-2">
            <Input
              data-testid="new-staff-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              className="bg-[#0B1120] border-border"
            />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="new-staff-role" className="bg-[#0B1120] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              data-testid="add-staff-btn"
              onClick={add}
              disabled={busy}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              <UserPlus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border max-h-72 overflow-y-auto thin-scroll">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0f1725] sticky top-0">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} data-testid={`staff-row-${s.id}`} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s.role}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      data-testid={`remove-staff-${s.id}`}
                      onClick={() => remove(s.id, s.name)}
                      size="sm"
                      variant="outline"
                      className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No active staff.</td></tr>
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
