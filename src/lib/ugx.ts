/** Whole shillings charged per 1 USD on an MTN prompt. Change this number to change every pack. */
export const UGX_PER_USD = 4100;

export function usdToUgx(usd: number): number {
  return Math.round(usd * UGX_PER_USD);
}

export function formatUgx(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
