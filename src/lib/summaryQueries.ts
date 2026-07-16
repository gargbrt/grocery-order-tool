// Where-clause shapes for the Summary counts, extracted so they're unit
// testable without a database. Received/Delivered/Cancelled all share the
// same universe (every order, regardless of isLikelyOrder) so the three
// numbers reconcile with each other and with what the Orders "All" tab
// shows - a past bug filtered Cancelled to real orders only, which silently
// dropped a dismissed "Needs Review" message from the count even though it
// visibly has status=CANCELLED in the Orders list.
export function receivedWhere(storeId: string, start: Date, end: Date) {
  return { storeId, createdAt: { gte: start, lt: end } };
}

// Open orders in the period - same filter as the Orders tab's "Open"
// category (real orders, not yet delivered or cancelled), scoped by date so
// it moves with the period selector like the other Summary tiles.
export function openOrdersWhere(storeId: string, start: Date, end: Date): Record<string, unknown> {
  return { storeId, createdAt: { gte: start, lt: end }, isLikelyOrder: true, status: { notIn: ["DELIVERED", "CANCELLED"] } };
}

export function statusChangeWhere(storeId: string, start: Date, end: Date, toStatus: string) {
  return {
    action: "STATUS_CHANGE",
    detail: { endsWith: `-> ${toStatus}` },
    createdAt: { gte: start, lt: end },
    order: { storeId },
  };
}

// Money received / receivables added must come from LedgerEntry, not Bill,
// because a manual payment or amount-due (recorded straight against a Home,
// independent of any order/bill - see POST /api/ledger) moves the ledger
// balance but has no Bill row at all. Computing these two figures from Bill
// alone silently ignores every manual entry while totalOutstanding (which is
// just each contact's latest runningBalance) includes them - that mismatch
// is exactly what produced numbers that didn't reconcile.
//
// Bill-driven entries always store `amount` as the positive bill total, with
// the bill's own paymentStatus deciding whether it was received or added as
// credit. Manual entries store `amount` as the signed balance delta itself
// (negative for a payment, positive for a charge) - so the two kinds need
// different rules to classify, but Math.abs(amount) is always the right
// magnitude to report either way.
export type LedgerFlowEntry = { amount: number; billId: string | null; billPaymentStatus: string | null };

export function isMoneyReceivedEntry(e: LedgerFlowEntry): boolean {
  if (e.billId) return e.billPaymentStatus === "PAID";
  return e.amount < 0;
}

export function classifyLedgerEntries(entries: LedgerFlowEntry[]): { moneyReceived: number; receivablesAdded: number } {
  let moneyReceived = 0;
  let receivablesAdded = 0;
  for (const e of entries) {
    if (isMoneyReceivedEntry(e)) moneyReceived += Math.abs(e.amount);
    else receivablesAdded += Math.abs(e.amount);
  }
  return { moneyReceived, receivablesAdded };
}

// The actual effect an entry had on the running balance - different from the
// "money received"/"receivables added" magnitudes above, because a bill paid
// immediately shows up in moneyReceived (real cash came in) but never
// touched the balance in the first place (delta 0). This is what "change in
// Total outstanding over the period" needs: summing this across a period's
// entries gives the true balance movement, not receivablesAdded minus
// moneyReceived (which would double-count paid-at-sale bills).
export function balanceDelta(e: LedgerFlowEntry): number {
  if (e.billId) return e.billPaymentStatus === "CREDIT" ? e.amount : 0;
  return e.amount;
}

export function sumBalanceDelta(entries: LedgerFlowEntry[]): number {
  return entries.reduce((sum, e) => sum + balanceDelta(e), 0);
}
