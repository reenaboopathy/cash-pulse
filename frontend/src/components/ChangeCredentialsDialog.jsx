import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api, apiErrorText } from "@/lib/api";
import { toast } from "sonner";

export default function ChangeCredentialsDialog({ open, onOpenChange }) {
  const [tab, setTab] = useState("pwd");
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  const doPassword = async () => {
    if (newP.length < 6) return toast.error("New password must be ≥ 6 characters");
    setBusy(true);
    try {
      await api.auth.changePassword(oldP, newP);
      toast.success("Password updated");
      setOldP("");
      setNewP("");
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorText(e, "Failed"));
    } finally {
      setBusy(false);
    }
  };

  const doPin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) return toast.error("PIN must be 4–6 digits");
    setBusy(true);
    try {
      await api.auth.changePin(curPin, newPin);
      toast.success("PIN updated");
      setCurPin("");
      setNewPin("");
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorText(e, "Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="creds-dialog" className="bg-[#111827] border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Admin Credentials</DialogTitle>
          <DialogDescription>Change your login password or the destructive-action PIN.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 bg-[#0f1725]">
            <TabsTrigger data-testid="tab-password" value="pwd">Password</TabsTrigger>
            <TabsTrigger data-testid="tab-pin" value="pin">PIN</TabsTrigger>
          </TabsList>
          <TabsContent value="pwd" className="mt-3 space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Current password</Label>
              <Input data-testid="old-password" type="password" value={oldP} onChange={(e) => setOldP(e.target.value)} className="mt-1 bg-[#0B1120] border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">New password (min 6)</Label>
              <Input data-testid="new-password" type="password" value={newP} onChange={(e) => setNewP(e.target.value)} className="mt-1 bg-[#0B1120] border-border" />
            </div>
            <Button data-testid="save-password" onClick={doPassword} disabled={busy || !oldP || !newP} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              {busy ? "Saving…" : "Update Password"}
            </Button>
          </TabsContent>
          <TabsContent value="pin" className="mt-3 space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Current PIN</Label>
              <Input
                data-testid="old-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={curPin}
                onChange={(e) => setCurPin(e.target.value.replace(/\D/g, ""))}
                className="mt-1 bg-[#0B1120] border-border font-mono text-center tracking-[0.6em] text-xl"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">New PIN (4–6 digits)</Label>
              <Input
                data-testid="new-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                className="mt-1 bg-[#0B1120] border-border font-mono text-center tracking-[0.6em] text-xl"
              />
            </div>
            <Button data-testid="save-pin" onClick={doPin} disabled={busy || !curPin || !newPin} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              {busy ? "Saving…" : "Update PIN"}
            </Button>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
