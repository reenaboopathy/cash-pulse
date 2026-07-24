import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { printer } from "@/lib/printer";
import { useStore } from "@/hooks/useStore";
import { toast } from "sonner";
import { Usb, Cable, Zap, X, AlertTriangle } from "lucide-react";

export default function SettingsDialog({ open, onOpenChange }) {
  const { drawerConnected, drawerInfo, setDrawerState } = useStore();
  const [busy, setBusy] = useState(false);

  const doSerial = async () => {
    setBusy(true);
    try {
      await printer.connectSerial();
      setDrawerState();
      toast.success("Web Serial printer connected.");
    } catch (e) {
      toast.error(e.message || "Serial connection failed");
    } finally {
      setBusy(false);
    }
  };

  const doUSB = async () => {
    setBusy(true);
    try {
      await printer.connectUSB();
      setDrawerState();
      toast.success("WebUSB printer connected.");
    } catch (e) {
      toast.error(e.message || "USB connection failed");
    } finally {
      setBusy(false);
    }
  };

  const testDrawer = async () => {
    setBusy(true);
    try {
      await printer.testDrawer();
      toast.success("Drawer pulse sent.");
    } catch (e) {
      toast.error(e.message || "Test failed");
    } finally {
      setBusy(false);
    }
  };

  const doDisconnect = async () => {
    await printer.disconnect();
    setDrawerState();
    toast("Printer disconnected.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="settings-dialog" className="bg-[#111827] border-border max-w-lg">
        <DialogHeader>
          <DialogTitle>Devices · Printer &amp; Cash Drawer</DialogTitle>
          <DialogDescription>
            Pair your thermal printer to send ESC/POS commands and drawer pulses.
            Requires <span className="font-mono">Chrome</span> or <span className="font-mono">Edge</span> on HTTPS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border p-4 bg-[#0f1725]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Status</div>
                <div className="mt-1 font-medium">
                  {drawerConnected ? (
                    <span className="text-emerald-400">Connected · {drawerInfo?.mode?.toUpperCase()}</span>
                  ) : (
                    <span className="text-slate-400">Not connected</span>
                  )}
                </div>
                {drawerInfo && (
                  <div className="font-mono text-xs text-muted-foreground mt-1">
                    VID: {drawerInfo.vendorId?.toString(16).padStart(4, "0")} · PID: {drawerInfo.productId?.toString(16).padStart(4, "0")}
                    {drawerInfo.product ? ` · ${drawerInfo.product}` : ""}
                  </div>
                )}
              </div>
              {drawerConnected && (
                <Button
                  data-testid="disconnect-btn"
                  variant="outline"
                  size="sm"
                  onClick={doDisconnect}
                  className="border-border"
                >
                  <X className="h-3 w-3 mr-1" /> Disconnect
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              data-testid="connect-serial"
              onClick={doSerial}
              disabled={busy}
              className="h-16 flex-col gap-1 bg-[#0f1725] border border-border hover:bg-[#1a2436] text-white"
            >
              <Cable className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Web Serial</span>
              <span className="text-[9px] font-normal text-emerald-400/80">Recommended</span>
            </Button>
            <Button
              data-testid="connect-usb"
              onClick={doUSB}
              disabled={busy}
              className="h-16 flex-col gap-1 bg-[#0f1725] border border-border hover:bg-[#1a2436] text-white"
            >
              <Usb className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">WebUSB</span>
              <span className="text-[9px] font-normal text-muted-foreground">Advanced</span>
            </Button>
          </div>

          <details data-testid="usb-troubleshoot" className="rounded-md border border-amber-500/30 bg-amber-500/5 text-xs">
            <summary className="cursor-pointer px-3 py-2 flex items-center gap-2 text-amber-400 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Getting <span className="font-mono">&quot;Access denied&quot;</span> on WebUSB?
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2 text-muted-foreground leading-relaxed">
              <p>
                <b className="text-foreground">Cause:</b> your OS&apos;s built-in printer driver has claimed the USB port
                exclusively — <span className="font-mono">USBDevice.open()</span> then fails with{" "}
                <span className="font-mono">Access denied</span>. This is not a SELTRACK bug.
              </p>
              <p className="text-foreground"><b>Easiest fix — use Web Serial instead:</b></p>
              <p>
                Most receipt printers (Epson TM-T, Star TSP, Xprinter, generic 58mm/80mm) also expose a virtual COM
                port. Click <b>Web Serial</b> above → pick the printer&apos;s COM/tty entry. This bypasses the OS driver
                lock entirely.
              </p>
              <p className="text-foreground"><b>Or force WebUSB by replacing the driver:</b></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>Windows</b>: install a <b>WinUSB</b> driver on the printer using{" "}
                  <a
                    href="https://zadig.akeo.ie"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 underline"
                  >
                    Zadig
                  </a>
                  , then reconnect.
                </li>
                <li>
                  <b>macOS</b>: remove the printer under <i>System Settings → Printers &amp; Scanners</i>, unplug/replug,
                  then try again.
                </li>
                <li>
                  <b>Linux</b>: unload the kernel printer driver — <span className="font-mono">sudo modprobe -r usblp</span>{" "}
                  — or add a udev rule for your printer&apos;s vendor ID.
                </li>
              </ul>
              <p className="pt-1">
                <b className="text-foreground">Note:</b> Web Serial &amp; WebUSB only work in <b>Chrome</b> or <b>Edge</b>{" "}
                over HTTPS.
              </p>
            </div>
          </details>

          <Button
            data-testid="test-drawer"
            onClick={testDrawer}
            disabled={busy || !drawerConnected}
            className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Zap className="h-4 w-4 mr-2" /> Test Drawer Pulse
          </Button>
          <div className="text-xs text-muted-foreground">
            Sends <span className="font-mono">ESC p 0 25 250</span> (0x1B 0x70 0x00 0x19 0xFA) to open the drawer.
          </div>

          <div className="border-t border-border pt-3 mt-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">Danger zone</div>
            <Button
              data-testid="reset-data-btn"
              disabled
              variant="outline"
              className="w-full border-rose-500/20 text-rose-400/50 cursor-not-allowed"
            >
              <AlertTriangle className="h-4 w-4 mr-2" /> Clear Data — Admin Only
            </Button>
            <div className="text-xs text-muted-foreground mt-1">
              Restricted to the <b className="text-amber-400">Admin Console</b> (login + PIN).
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
