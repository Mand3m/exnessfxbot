import { getPair } from "./pairs";

export const RISK_TIERS = [
  { pct: 1, label: "Low risk" },
  { pct: 2, label: "Small risk" },
  { pct: 3, label: "Moderate risk" },
  { pct: 5, label: "High risk" },
  { pct: 10, label: "Very high risk" },
  { pct: 15, label: "Extremely high risk" },
] as const;

export const DEFAULT_RISK_PCT = 1;
export const GOLD_MIN_EQUITY_USD = 500;

export function accountAcceptsPair(equityUsd: number, pairId: string) {
  if (pairId === "XAUUSD" && equityUsd < GOLD_MIN_EQUITY_USD) return false;
  return true;
}

export function positionForRisk(balance: number, stopPips: number, pairId: string, riskPct: number) {
  const pair = getPair(pairId);
  const pipValuePerLot = pair?.pipValuePerLot ?? 10;
  const riskMoney = balance * (riskPct / 100);
  const units = stopPips > 0 ? Math.round((riskMoney / (stopPips * (pipValuePerLot / 100000))) / 100) * 100 : 0;
  const lots = units / 100000;
  const mini = units / 10000;
  const micro = units / 1000;
  const after10 = balance * Math.pow(1 - riskPct / 100, 10);
  return {
    units,
    lots,
    mini,
    micro,
    atRisk: riskMoney,
    perPip: stopPips > 0 ? riskMoney / stopPips : 0,
    after10,
    remainingPct: (after10 / balance) * 100,
  };
}
