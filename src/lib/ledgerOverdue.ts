// Shared with the Ledger page and its regression test.
export const OVERDUE_DAYS = 30;

// "Payment due but not received for 30+ days" - since there's no separate
// payment-recording flow tied to a specific bill, this uses "no ledger
// activity in 30+ days while balance is still positive" as the proxy.
export function isOverdue(balance: number, lastActivityAt: string | Date | null, now: Date = new Date()): boolean {
  if (balance <= 0 || !lastActivityAt) return false;
  const ageMs = now.getTime() - new Date(lastActivityAt).getTime();
  return ageMs > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
}
