import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCurrentAdmin, loginAdmin, logoutAdmin } from "./admin-api";
import type { AdminUser } from "./types";

type AuthContextValue = {
  admin: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void getCurrentAdmin()
      .then((currentAdmin) => {
        if (active) setAdmin(currentAdmin);
      })
      .catch(() => {
        if (active) setAdmin(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const currentAdmin = await loginAdmin({ username, password });
    setAdmin(currentAdmin);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      setAdmin(null);
    }
  }, []);

  const refreshAdmin = useCallback(async () => {
    setAdmin(await getCurrentAdmin());
  }, []);

  const value = useMemo(
    () => ({ admin, loading, login, logout, refreshAdmin }),
    [admin, loading, login, logout, refreshAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAdminAuth harus digunakan di dalam AuthProvider.");
  }

  return context;
}
