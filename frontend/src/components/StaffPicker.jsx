import React from "react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useStore } from "@/hooks/useStore";
import { UserCheck } from "lucide-react";

/**
 * Mandatory in-dialog staff picker. Every drawer action must record WHO did it,
 * so we ask again inside each modal (top-nav dropdown is just a default hint).
 */
export default function StaffPicker({ value, onChange, testid = "dialog-staff" }) {
  const { staff } = useStore();
  return (
    <div>
      <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <UserCheck className="h-3.5 w-3.5 text-amber-400" />
        Performed by <span className="text-rose-400">*</span>
      </Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger
          data-testid={testid}
          className={`mt-1 bg-[#0B1120] border ${value ? "border-border" : "border-rose-500/40"}`}
        >
          <SelectValue placeholder="Select the user performing this action…" />
        </SelectTrigger>
        <SelectContent>
          {staff.map((s) => (
            <SelectItem key={s.id} value={s.id} data-testid={`${testid}-option-${s.id}`}>
              <div className="flex flex-col">
                <span className="font-medium">{s.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.role}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!value && (
        <div className="text-[11px] text-rose-400 mt-1">
          User is required — the drawer will not open without identifying who is performing this action.
        </div>
      )}
    </div>
  );
}
