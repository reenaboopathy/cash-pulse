import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

export const api = {
  staff: {
    list: () => http.get("/staff").then((r) => r.data),
    create: (body) => http.post("/staff", body).then((r) => r.data),
  },
  shifts: {
    current: () => http.get("/shifts/current").then((r) => r.data),
    open: (body) => http.post("/shifts/open", body).then((r) => r.data),
    close: (body) => http.post("/shifts/close", body).then((r) => r.data),
    list: () => http.get("/shifts").then((r) => r.data),
    get: (id) => http.get(`/shifts/${id}`).then((r) => r.data),
  },
  transactions: {
    list: (shiftId) => http.get(`/transactions${shiftId ? `?shift_id=${shiftId}` : ""}`).then((r) => r.data),
    create: (body) => http.post("/transactions", body).then((r) => r.data),
  },
  reports: {
    x: (shiftId) => http.get(`/reports/x${shiftId ? `?shift_id=${shiftId}` : ""}`).then((r) => r.data),
    z: (shiftId) => http.get(`/reports/z?shift_id=${shiftId}`).then((r) => r.data),
    daily: (day) => http.get(`/reports/daily${day ? `?day=${day}` : ""}`).then((r) => r.data),
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
