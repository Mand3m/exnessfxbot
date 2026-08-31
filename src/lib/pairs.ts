export type PairId = "USDJPY" | "XAUUSD" | "EURUSD" | "GBPJPY";

export type Pair = {
  id: PairId;
  label: string;
  base: string;
  quote: string;
  baseFlag: string;
  quoteFlag: string;
  pipSize: number;
  digits: number;
  /** Approximate USD value of 1 pip on 1.00 lot */
  pipValuePerLot: number;
  /** TradingView symbol for the embed */
  tvSymbol: string;
};

export const PAIRS: Pair[] = [
  {
    id: "USDJPY",
    label: "USD/JPY",
    base: "USD",
    quote: "JPY",
    baseFlag: "🇺🇸",
    quoteFlag: "🇯🇵",
    pipSize: 0.01,
    digits: 3,
    pipValuePerLot: 6.8,
    tvSymbol: "FX:USDJPY",
  },
  {
    id: "XAUUSD",
    label: "XAU/USD",
    base: "XAU",
    quote: "USD",
    baseFlag: "🥇",
    quoteFlag: "🇺🇸",
    pipSize: 0.1,
    digits: 2,
    pipValuePerLot: 10,
    tvSymbol: "OANDA:XAUUSD",
  },
  {
    id: "EURUSD",
    label: "EUR/USD",
    base: "EUR",
    quote: "USD",
    baseFlag: "🇪🇺",
    quoteFlag: "🇺🇸",
    pipSize: 0.0001,
    digits: 5,
    pipValuePerLot: 10,
    tvSymbol: "FX:EURUSD",
  },
  {
    id: "GBPJPY",
    label: "GBP/JPY",
    base: "GBP",
    quote: "JPY",
    baseFlag: "🇬🇧",
    quoteFlag: "🇯🇵",
    pipSize: 0.01,
    digits: 3,
    pipValuePerLot: 6.8,
    tvSymbol: "FX:GBPJPY",
  },
];

export function getPair(id: string): Pair | undefined {
  return PAIRS.find((p) => p.id === id);
}

export function pairSlug(id: string): string {
  return id.toLowerCase();
}

export function pairFromSlug(slug: string): Pair | undefined {
  const key = String(slug || "").replace("/", "").toLowerCase();
  return PAIRS.find((p) => p.id.toLowerCase() === key);
}

export function formatPrice(pair: Pair, price: number): string {
  return price.toFixed(pair.digits);
}

export function pipsBetween(pair: Pair, a: number, b: number): number {
  return Math.round(Math.abs(a - b) / pair.pipSize);
}
