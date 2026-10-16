import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, apiErrorText } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("seltrack:token");
    if (!token) {
      setAdmin(null);
      setChecking(false);
      return null;
    }
    try {
      const me = await api.auth.me();
      setAdmin(me);
      return me;
    } catch (e) {
      localStorage.removeItem("seltrack:token");
      setAdmin(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (mobile, password) => {
    try {
      const { token, admin: a } = await api.auth.login(mobile, password);
      localStorage.setItem("seltrack:token", token);
      setAdmin(a);
      return { ok: true, admin: a };
    } catch (e) {
      return { ok: false, error: apiErrorText(e, "Login failed") };
    }
  };

  const logout = () => {
    localStorage.removeItem("seltrack:token");
    setAdmin(null);
  };

  return (
    <AuthCtx.Provider value={{ admin, checking, login, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
