import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminQuery } from "../admin-auth/admin-api";
import { useAdminAuth } from "../admin-auth/AuthProvider";

const STORAGE_KEY = "bdi-active-year";
const CURRENT_YEAR = Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()));
const NEARBY_YEARS = Array.from({ length: 6 }, (_, index) => CURRENT_YEAR - 2 + index);

type ActiveYearContextValue = {
  activeYear: number;
  availableYears: number[];
  setActiveYear: (year: number) => void;
  refreshYears: () => Promise<void>;
};

const ActiveYearContext = createContext<ActiveYearContextValue | null>(null);

function storedYear() {
  const value = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isInteger(value) && value >= 2000 && value <= 2200 ? value : CURRENT_YEAR;
}

export function ActiveYearProvider({ children }: { children: ReactNode }) {
  const { admin } = useAdminAuth();
  const [activeYear, setActiveYearState] = useState(storedYear);
  const [availableYears, setAvailableYears] = useState<number[]>(() => [...new Set([...NEARBY_YEARS, storedYear()])].sort((a, b) => b - a));

  const refreshYears = useCallback(async () => {
    if (!admin) {
      setAvailableYears([...NEARBY_YEARS].sort((a, b) => b - a));
      return;
    }

    const payload = await adminQuery<{ years: number[] }>("/api/admin/dashboard/years");
    const years = [...new Set([...NEARBY_YEARS, ...payload.years])].sort((a, b) => b - a);
    setAvailableYears(years);
    setActiveYearState((current) => years.includes(current) ? current : CURRENT_YEAR);
  }, [admin]);

  useEffect(() => {
    void refreshYears().catch(() => setAvailableYears((current) => [...new Set([...NEARBY_YEARS, ...current])].sort((a, b) => b - a)));
  }, [refreshYears]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(activeYear));
  }, [activeYear]);

  const setActiveYear = useCallback((year: number) => {
    if (Number.isInteger(year) && year >= 2000 && year <= 2200) setActiveYearState(year);
  }, []);

  const value = useMemo(
    () => ({ activeYear, availableYears, setActiveYear, refreshYears }),
    [activeYear, availableYears, refreshYears, setActiveYear],
  );

  return <ActiveYearContext.Provider value={value}>{children}</ActiveYearContext.Provider>;
}

export function useActiveYear() {
  const context = useContext(ActiveYearContext);
  if (!context) throw new Error("useActiveYear harus digunakan di dalam ActiveYearProvider.");
  return context;
}

export function ActiveYearIndicator() {
  const { activeYear } = useActiveYear();
  return <span className="active-year-indicator">Data Tahun {activeYear}</span>;
}

export function withActiveYear(path: string, activeYear: number) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}year=${activeYear}`;
}
