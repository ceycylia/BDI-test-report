import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FUNDING_SOURCE_STORAGE_KEY, fundingSourceLabel, type FundingSource } from "./funding-source";
export { FUNDING_SOURCE_STORAGE_KEY, fundingSourceLabel, type FundingSource } from "./funding-source";

const FundingSourceContext = createContext<{
  activeFundingSource: FundingSource;
  setActiveFundingSource: (source: FundingSource) => void;
} | null>(null);

function storedFundingSource(): FundingSource {
  return window.localStorage.getItem(FUNDING_SOURCE_STORAGE_KEY) === "PNBP" ? "PNBP" : "RUPIAH_MURNI";
}

export function ActiveFundingSourceProvider({ children }: { children: ReactNode }) {
  const [activeFundingSource, setActiveFundingSourceState] = useState<FundingSource>(storedFundingSource);
  useEffect(() => window.localStorage.setItem(FUNDING_SOURCE_STORAGE_KEY, activeFundingSource), [activeFundingSource]);
  useEffect(() => {
    const sync = (event: Event) => {
      const source = (event as CustomEvent<FundingSource>).detail;
      if (source === "RUPIAH_MURNI" || source === "PNBP") setActiveFundingSourceState(source);
    };
    window.addEventListener("bdi:funding-source-change", sync);
    return () => window.removeEventListener("bdi:funding-source-change", sync);
  }, []);
  const setActiveFundingSource = useCallback((source: FundingSource) => {
    window.localStorage.setItem(FUNDING_SOURCE_STORAGE_KEY, source);
    setActiveFundingSourceState(source);
  }, []);
  const value = useMemo(() => ({ activeFundingSource, setActiveFundingSource }), [activeFundingSource, setActiveFundingSource]);
  return <FundingSourceContext.Provider value={value}>{children}</FundingSourceContext.Provider>;
}

export function useActiveFundingSource() {
  const context = useContext(FundingSourceContext);
  if (!context) throw new Error("useActiveFundingSource harus digunakan di dalam ActiveFundingSourceProvider.");
  return context;
}

export function FundingSourceIndicator() {
  const { activeFundingSource } = useActiveFundingSource();
  return <span className="active-funding-indicator">Sumber: {fundingSourceLabel(activeFundingSource)}</span>;
}

export function withActiveFundingSource(path: string, source: FundingSource) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}fundingSource=${source}`;
}
