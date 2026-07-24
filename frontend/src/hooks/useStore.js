import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { printer } from "@/lib/printer";

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [staff, setStaff] = useState([]);
  const [activeStaffId, setActiveStaffId] = useState(() => localStorage.getItem("seltrack:staffId") || "");
  const [shift, setShift] = useState(null);
  const [balance, setBalance] = useState(0);
  const [totals, setTotals] = useState({ IN: 0, OUT: 0, ADJUSTMENT: 0 });
  const [transactions, setTransactions] = useState([]);
  const [drawerConnected, setDrawerConnected] = useState(false);
  const [drawerInfo, setDrawerInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const activeStaff = staff.find((s) => s.id === activeStaffId) || null;

  const refreshStaff = useCallback(async () => {
    const list = await api.staff.list();
    setStaff(list);
    if (!activeStaffId && list[0]) {
      setActiveStaffId(list[0].id);
    }
    return list;
  }, [activeStaffId]);

  const refreshShift = useCallback(async () => {
    const data = await api.shifts.current();
    setShift(data.shift);
    setBalance(data.balance);
    setTotals(data.totals);
    return data;
  }, []);

  const refreshTransactions = useCallback(async () => {
    const list = await api.transactions.list();
    setTransactions(list);
    return list;
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshShift(), refreshTransactions()]);
  }, [refreshShift, refreshTransactions]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refreshStaff();
        await refreshShift();
        await refreshTransactions();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeStaffId) localStorage.setItem("seltrack:staffId", activeStaffId);
  }, [activeStaffId]);

  const setDrawerState = useCallback(() => {
    setDrawerConnected(printer.isConnected);
    setDrawerInfo(printer.info);
  }, []);

  const value = {
    staff,
    activeStaffId,
    setActiveStaffId,
    activeStaff,
    shift,
    balance,
    totals,
    transactions,
    loading,
    drawerConnected,
    drawerInfo,
    setDrawerState,
    refreshStaff,
    refreshShift,
    refreshTransactions,
    refreshAll,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
