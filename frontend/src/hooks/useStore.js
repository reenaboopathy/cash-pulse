import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { printer } from "@/lib/printer";

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [staff, setStaff] = useState([]);
  const [shift, setShift] = useState(null);
  const [balance, setBalance] = useState(0);
  const [totalsByMethod, setTotalsByMethod] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [drawerConnected, setDrawerConnected] = useState(false);
  const [drawerInfo, setDrawerInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshStaff = useCallback(async () => {
    const list = await api.staff.list();
    setStaff(list);
    return list;
  }, []);

  const refreshShift = useCallback(async () => {
    const data = await api.shifts.current();
    setShift(data.shift);
    setBalance(data.balance);
    setTotalsByMethod(data.totals_by_method);
    if (data.banks) setBanks(data.banks);
    return data;
  }, []);

  const refreshTransactions = useCallback(async () => {
    const list = await api.transactions.list();
    setTransactions(list);
    return list;
  }, []);

  const refreshBanks = useCallback(async () => {
    const list = await api.banks.list();
    setBanks(list);
    return list;
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshShift(), refreshTransactions(), refreshBanks()]);
  }, [refreshShift, refreshTransactions, refreshBanks]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refreshStaff();
        await refreshShift();
        await refreshTransactions();
        await refreshBanks();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDrawerState = useCallback(() => {
    setDrawerConnected(printer.isConnected);
    setDrawerInfo(printer.info);
  }, []);

  const value = {
    staff,
    shift,
    balance,
    totalsByMethod,
    transactions,
    banks,
    loading,
    drawerConnected,
    drawerInfo,
    setDrawerState,
    refreshStaff,
    refreshShift,
    refreshTransactions,
    refreshBanks,
    refreshAll,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
