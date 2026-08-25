import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { http, setToken, loadToken, apiError } from "@/lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, obj = user
  const [config, setConfig] = useState(null);

  const refresh = useCallback(async () => {
    try {
      loadToken();
      const { data } = await http.get("/auth/me");
      setUser(data);
    } catch {
      // don't clobber an already logged-in user if a stale check resolves late
      setUser((prev) => (prev && prev.portal ? prev : false));
    }
  }, []);

  useEffect(() => {
    http.get("/config").then((r) => setConfig(r.data)).catch(() => {});
    refresh();
  }, [refresh]);

  const login = async (identifier, password, portal) => {
    try {
      const { data } = await http.post("/auth/login", { identifier, password, portal });
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiError(e.response?.data?.detail) };
    }
  };

  const logout = async () => {
    try { await http.post("/auth/logout"); } catch {}
    setToken(null);
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, config, login, logout, refresh, setConfig }}>
      {children}
    </AuthCtx.Provider>
  );
}
