/** Client-safe: whether the published entry has filled. */
export function isEntered(signal: {
  enteredAt?: string;
  mt5?: { message?: string };
}): boolean {
  if (signal.enteredAt) return true;
  const msg = signal.mt5?.message || "";
  return msg.startsWith("market ");
}
