import React, { useEffect, useState } from "react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Check, X } from "lucide-react";
import { api, apiErrorText } from "@/lib/api";
import { toast } from "sonner";

/**
 * Category (reason) dropdown backed by /api/reasons.
 * Includes inline "+ Add new reason" that creates the reason and selects it.
 */
export default function CategoryPicker({ category, value, onChange, testid = "category" }) {
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const list = await api.reasons.list(category);
      setItems(list);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    if (category) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const addNew = async () => {
    const l = newLabel.trim();
    if (!l) return;
    setBusy(true);
    try {
      const r = await api.reasons.create(l, category);
      await load();
      onChange(r.label);
      setNewLabel("");
      setAdding(false);
      toast.success(`Added "${r.label}"`);
    } catch (e) {
      toast.error(apiErrorText(e, "Failed to add reason"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Reason / Category
        </Label>
        {!adding && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
            data-testid={`${testid}-add-btn`}
            className="h-6 px-2 text-amber-400 hover:text-amber-300"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add new
          </Button>
        )}
      </div>

      {!adding ? (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger data-testid={testid} className="bg-[#0B1120] border-border mt-1">
            <SelectValue placeholder="Select a reason…" />
          </SelectTrigger>
          <SelectContent>
            {items.map((r) => (
              <SelectItem key={r.id} value={r.label} data-testid={`${testid}-opt-${r.id}`}>
                {r.label}
              </SelectItem>
            ))}
            {items.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No reasons — add one above.</div>
            )}
          </SelectContent>
        </Select>
      ) : (
        <div className="mt-1 grid grid-cols-[1fr_auto_auto] gap-2">
          <Input
            data-testid={`${testid}-new-input`}
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNew()}
            placeholder="Enter a new reason…"
            className="bg-[#0B1120] border-border"
          />
          <Button
            type="button"
            data-testid={`${testid}-new-save`}
            onClick={addNew}
            disabled={busy || !newLabel.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => { setAdding(false); setNewLabel(""); }}
            className="border-border"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
