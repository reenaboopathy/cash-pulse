import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

// Attach JWT for admin routes
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("seltrack:token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  auth: {
    login: (mobile, password) => http.post("/auth/login", { mobile, password }).then((r) => r.data),
    me: () => http.get("/auth/me").then((r) => r.data),
    changePassword: (old_password, new_password) =>
      http.post("/auth/change-password", { old_password, new_password }).then((r) => r.data),
    changePin: (current_pin, new_pin) =>
      http.post("/auth/change-pin", { current_pin, new_pin }).then((r) => r.data),
    verifyPin: (pin) => http.post("/auth/verify-pin", { pin }).then((r) => r.data),
  },
  staff: {
    list: () => http.get("/staff").then((r) => r.data),
    create: (body) => http.post("/staff", body).then((r) => r.data),
    update: (id, body) => http.patch(`/staff/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/staff/${id}`).then((r) => r.data),
  },
  reasons: {
    list: (category) => http.get(`/reasons${category ? `?category=${category}` : ""}`).then((r) => r.data),
    create: (label, category) => http.post("/reasons", { label, category }).then((r) => r.data),
    remove: (id) => http.delete(`/reasons/${id}`).then((r) => r.data),
  },
  banks: {
    list: () => http.get("/banks").then((r) => r.data),
    create: (body) => http.post("/banks", body).then((r) => r.data),
    update: (id, body) => http.patch(`/banks/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/banks/${id}`).then((r) => r.data),
  },
  shifts: {
    current: () => http.get("/shifts/current").then((r) => r.data),
    open: (body) => http.post("/shifts/open", body).then((r) => r.data),
    close: (body) => http.post("/shifts/close", body).then((r) => r.data),
    list: () => http.get("/shifts").then((r) => r.data),
    get: (id) => http.get(`/shifts/${id}`).then((r) => r.data),
  },
  transactions: {
    list: (shiftId, method) => {
      const params = [];
      if (shiftId) params.push(`shift_id=${shiftId}`);
      if (method) params.push(`method=${method}`);
      const q = params.length ? `?${params.join("&")}` : "";
      return http.get(`/transactions${q}`).then((r) => r.data);
    },
    create: (body) => http.post("/transactions", body).then((r) => r.data),
  },
  reports: {
    x: (shiftId) => http.get(`/reports/x${shiftId ? `?shift_id=${shiftId}` : ""}`).then((r) => r.data),
    z: (shiftId) => http.get(`/reports/z?shift_id=${shiftId}`).then((r) => r.data),
    daily: (day) => http.get(`/reports/daily${day ? `?day=${day}` : ""}`).then((r) => r.data),
  },
  admin: {
    dashboard: () => http.get("/admin/dashboard").then((r) => r.data),
    reset: (pin, keepStaff = true) =>
      http.post(`/admin/reset?keep_staff=${keepStaff}`, { pin }).then((r) => r.data),
  },
};

export const INR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];
export const DENOM_KEYS = DENOMS.map((d) => `d${d}`);
export const EMPTY_DENOM = DENOM_KEYS.reduce((a, k) => ({ ...a, [k]: 0 }), {});
export const denomTotal = (obj) =>
  DENOMS.reduce((sum, d) => sum + (Number(obj[`d${d}`]) || 0) * d, 0);

export function apiErrorText(e, fallback = "Something went wrong") {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(", ");
  return String(d);
}
