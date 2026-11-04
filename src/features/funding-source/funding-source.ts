export type FundingSource = "RUPIAH_MURNI" | "PNBP";

export const FUNDING_SOURCE_STORAGE_KEY = "bdi-active-funding-source";

export function fundingSourceLabel(source: FundingSource) {
  return source === "PNBP" ? "PNBP" : "Rupiah Murni";
}
