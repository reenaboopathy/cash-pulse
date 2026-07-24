import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { api, apiErrorText } from "@/lib/api";
import { toast } from "sonner";

/**
 * Admin PIN prompt used for destructive actions.
 * Calls onSuccess() after backend verifies the PIN.
 */
export default function PinPrompt({ open, onOpenChange, title = "Admin PIN required", description, onSuccess }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\d{4,6}$/.test(pin)) return toast.error("Enter 4–6 digit PIN");
    setBusy(true);
    try {
      await api.auth.verifyPin(pin);
      onOpenChange(false);
      setPin("");
      onSuccess?.(pin);
    } catch (e) {
      toast.error(apiErrorText(e, "Incorrect PIN"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPin(""); } onOpenChange(v); }}>
      <DialogContent data-testid="pin-dialog" className="bg-[#111827] border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-400" /> {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">PIN</Label>
          <Input
            data-testid="pin-input"
            autoFocus
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••"
            className="mt-1 bg-[#0B1120] border-border font-mono text-center text-2xl h-14 tracking-[0.6em]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
          <Button
            data-testid="pin-submit"
            onClick={submit}
            disabled={busy}
            className="bg-rose-500 hover:bg-rose-400 text-white font-semibold"
          >
            {busy ? "Verifying…" : "Verify PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
