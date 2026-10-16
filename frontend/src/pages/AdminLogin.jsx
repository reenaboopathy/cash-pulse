import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Phone } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a 10-digit mobile number.");
      return;
    }
    setBusy(true);
    const res = await login(mobile, password);
    setBusy(false);
    if (res.ok) {
      toast.success(`Welcome, ${res.admin.name}`);
      nav("/admin", { replace: true });
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-lg mb-5">
            <img
              src="https://customer-assets-v7afamib.emergentagent.net/job_cash-pulse-16/artifacts/oon08w84_DTF%20STICKER%20PRINTING%20%283%29.webp"
              alt="SelSolve"
              className="h-28 w-28 object-contain"
              data-testid="login-logo"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Login</h1>
          <p className="text-sm text-muted-foreground mt-1">Cash &amp; Bank Console</p>
        </div>

        <form onSubmit={submit} className="rounded-lg border border-border bg-[#111827] p-6 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              <Phone className="inline h-3.5 w-3.5 mr-1 -mt-0.5" /> Mobile Number
            </Label>
            <Input
              data-testid="login-mobile"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
              placeholder="10-digit mobile"
              className="mt-1 bg-[#0B1120] border-border font-mono text-lg h-12"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              <Lock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" /> Password
            </Label>
            <Input
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 bg-[#0B1120] border-border font-mono text-lg h-12"
            />
          </div>
          <Button
            data-testid="login-submit"
            type="submit"
            disabled={busy}
            className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-base"
          >
            {busy ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-amber-400" data-testid="back-to-register">
            ← Back to Cash Register
          </Link>
        </div>
      </div>
    </div>
  );
}
