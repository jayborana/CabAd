import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({ baseURL: API, withCredentials: true });

// Attach per-portal bearer token as fallback (preview envs often drop the
// httpOnly cookie, so we always attach the stored token too).
export function setToken(t) {
  if (t) localStorage.setItem("sawari_token", t);
  else localStorage.removeItem("sawari_token");
}
export function loadToken() {
  return localStorage.getItem("sawari_token");
}
http.interceptors.request.use((config) => {
  const t = localStorage.getItem("sawari_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function apiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const inr = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
