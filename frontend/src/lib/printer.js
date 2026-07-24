/**
 * Web Serial / WebUSB thermal printer + cash drawer driver.
 * Uses ESC/POS commands. Chrome/Edge on HTTPS only.
 *
 * Drawer pulse: ESC p m t1 t2  ->  0x1B, 0x70, 0x00, 0x19, 0xFA
 * Cut paper:    GS V 66 0     ->  0x1D, 0x56, 0x42, 0x00
 */

const enc = new TextEncoder();

// ESC/POS byte sequences
const ESC = 0x1b;
const GS = 0x1d;

export const CMD = {
  init: new Uint8Array([ESC, 0x40]),
  boldOn: new Uint8Array([ESC, 0x45, 0x01]),
  boldOff: new Uint8Array([ESC, 0x45, 0x00]),
  alignLeft: new Uint8Array([ESC, 0x61, 0x00]),
  alignCenter: new Uint8Array([ESC, 0x61, 0x01]),
  alignRight: new Uint8Array([ESC, 0x61, 0x02]),
  doubleSizeOn: new Uint8Array([GS, 0x21, 0x11]),
  doubleSizeOff: new Uint8Array([GS, 0x21, 0x00]),
  cut: new Uint8Array([GS, 0x56, 0x42, 0x00]),
  drawerPulse: new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]),
  feed: (n = 3) => new Uint8Array([ESC, 0x64, n]),
};

class SeltrackPrinter {
  constructor() {
    this.mode = null; // 'serial' | 'usb'
    this.serialPort = null;
    this.serialWriter = null;
    this.usbDevice = null;
    this.usbEndpoint = null;
  }

  get isConnected() {
    return !!(this.serialWriter || this.usbEndpoint);
  }

  get info() {
    if (this.mode === "serial" && this.serialPort) {
      const i = this.serialPort.getInfo?.() || {};
      return { mode: "serial", vendorId: i.usbVendorId, productId: i.usbProductId };
    }
    if (this.mode === "usb" && this.usbDevice) {
      return {
        mode: "usb",
        vendorId: this.usbDevice.vendorId,
        productId: this.usbDevice.productId,
        product: this.usbDevice.productName,
      };
    }
    return null;
  }

  async connectSerial(baudRate = 9600) {
    if (!("serial" in navigator)) throw new Error("Web Serial API not supported in this browser.");
    this.serialPort = await navigator.serial.requestPort();
    await this.serialPort.open({ baudRate });
    this.serialWriter = this.serialPort.writable.getWriter();
    this.mode = "serial";
    await this._writeRaw(CMD.init);
    return this.info;
  }

  async connectUSB() {
    if (!("usb" in navigator)) throw new Error("WebUSB API not supported in this browser.");
    // Ask the browser to show the device picker
    try {
      this.usbDevice = await navigator.usb.requestDevice({ filters: [{ classCode: 7 }, {}] });
    } catch (e) {
      if (e && e.name === "NotFoundError") throw new Error("No device selected.");
      throw e;
    }

    // Try to open — this is where OS driver conflicts surface as "Access denied"
    try {
      await this.usbDevice.open();
    } catch (e) {
      const raw = (e && e.message) || String(e);
      this.usbDevice = null;
      if (/Access denied|already open|Unable to claim|Interface|unsupported/i.test(raw)) {
        const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
        let hint;
        if (/win/i.test(plat)) {
          hint = "On Windows the built-in printer driver locks the USB port. Fix: install a WinUSB driver on the printer using Zadig (https://zadig.akeo.ie) — OR simply pair via 'Web Serial' below (most receipt printers also expose a virtual COM port).";
        } else if (/mac/i.test(plat)) {
          hint = "On macOS the system's printer driver claims the port exclusively. Fix: remove the printer from System Settings → Printers & Scanners, unplug/replug — OR use 'Web Serial' below.";
        } else {
          hint = "On Linux the kernel driver 'usblp' claims the printer. Fix: `sudo modprobe -r usblp` (or add a udev rule granting your user access) — OR use 'Web Serial' below.";
        }
        throw new Error(`OS denied access to the USB device. ${hint}`);
      }
      throw new Error(raw || "Failed to open USB device.");
    }

    try {
      if (this.usbDevice.configuration === null) await this.usbDevice.selectConfiguration(1);

      // Find the first interface with a bulk OUT endpoint
      let picked = null;
      for (const iface of this.usbDevice.configuration.interfaces) {
        for (const alt of iface.alternates) {
          const out = alt.endpoints.find((ep) => ep.direction === "out" && ep.type === "bulk");
          if (out) {
            picked = { iface, alt, out };
            break;
          }
        }
        if (picked) break;
      }
      if (!picked) throw new Error("Printer has no bulk OUT endpoint (unsupported device).");

      await this.usbDevice.claimInterface(picked.iface.interfaceNumber);
      if (picked.alt.alternateSetting !== 0) {
        await this.usbDevice.selectAlternateInterface(picked.iface.interfaceNumber, picked.alt.alternateSetting);
      }
      this.usbEndpoint = picked.out.endpointNumber;
      this.mode = "usb";
      await this._writeRaw(CMD.init);
      return this.info;
    } catch (e) {
      // clean up on partial-open failure
      try { await this.usbDevice.close(); } catch (_) { /* ignore */ }
      this.usbDevice = null;
      const raw = (e && e.message) || String(e);
      if (/claim|busy|Unable/i.test(raw)) {
        throw new Error(`Unable to claim the printer interface — the OS printer driver is holding it. Try 'Web Serial' instead, or remove the printer from your OS's printer settings and retry.`);
      }
      throw new Error(raw);
    }
  }

  async disconnect() {
    try {
      if (this.serialWriter) {
        await this.serialWriter.releaseLock?.();
        this.serialWriter = null;
      }
      if (this.serialPort) {
        await this.serialPort.close?.();
        this.serialPort = null;
      }
      if (this.usbDevice) {
        await this.usbDevice.close?.();
        this.usbDevice = null;
      }
    } catch (e) {
      /* swallow */
    }
    this.mode = null;
    this.usbEndpoint = null;
  }

  async _writeRaw(bytes) {
    if (this.mode === "serial" && this.serialWriter) {
      await this.serialWriter.write(bytes);
    } else if (this.mode === "usb" && this.usbDevice && this.usbEndpoint) {
      await this.usbDevice.transferOut(this.usbEndpoint, bytes);
    } else {
      throw new Error("Printer not connected. Open Settings and pair your device.");
    }
  }

  async _writeMany(chunks) {
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    await this._writeRaw(out);
  }

  async openDrawer() {
    await this._writeRaw(CMD.drawerPulse);
  }

  async testDrawer() {
    // Init + pulse
    await this._writeMany([CMD.init, CMD.drawerPulse]);
  }

  async printReceipt({ store = "SELTRACK", header = "CASH RECEIPT", lines = [], footer = "THANK YOU", openDrawer = true }) {
    const chunks = [CMD.init, CMD.alignCenter, CMD.boldOn, CMD.doubleSizeOn, enc.encode(`${store}\n`), CMD.doubleSizeOff, CMD.boldOff, enc.encode(`${header}\n`), enc.encode("--------------------------------\n"), CMD.alignLeft];
    for (const l of lines) chunks.push(enc.encode(`${l}\n`));
    chunks.push(enc.encode("--------------------------------\n"));
    chunks.push(CMD.alignCenter, enc.encode(`${footer}\n`), CMD.feed(3), CMD.cut);
    if (openDrawer) chunks.push(CMD.drawerPulse);
    await this._writeMany(chunks);
  }
}

export const printer = new SeltrackPrinter();

export function buildReceiptLines({ txn, shift, staffName, balance }) {
  const dt = new Date(txn.created_at || Date.now()).toLocaleString("en-IN");
  const sign = txn.type === "OUT" ? "-" : txn.type === "IN" ? "+" : "±";
  return [
    `Receipt #${String(txn.receipt_number || 0).padStart(6, "0")}`,
    `Date   : ${dt}`,
    `Staff  : ${staffName}`,
    `Type   : ${txn.type}`,
    `Cat.   : ${txn.category}`,
    ``,
    `Amount : ${sign} INR ${Number(txn.amount).toFixed(2)}`,
    `Note   : ${txn.note || "-"}`,
    ``,
    `Shift  : ${shift?.id?.slice(0, 8) || "-"}`,
    `Balance: INR ${Number(balance).toFixed(2)}`,
  ];
}
