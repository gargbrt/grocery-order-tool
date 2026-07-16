// Sum of finalized-bill totals across a Home's orders - their lifetime value
// to the store. Shared by the Ledger "sort by total order value" and the
// Summary "top customers" list so both use the exact same definition.
export function totalOrderValue(orders: { bill: { total: number } | null }[]): number {
  return orders.reduce((sum, o) => sum + (o.bill?.total ?? 0), 0);
}

// Same idea, scoped to bills finalized within [start, end) - the "how much
// did we bill in this period" figure for the Summary table. finalizedAt (not
// createdAt) is what's compared, since a bill can be finalized well after
// the order itself was received.
export function totalOrderValueInRange(
  orders: { bill: { total: number; finalizedAt: Date } | null }[],
  start: Date,
  end: Date
): number {
  return orders.reduce((sum, o) => {
    if (!o.bill) return sum;
    const finalizedAt = o.bill.finalizedAt;
    return finalizedAt >= start && finalizedAt < end ? sum + o.bill.total : sum;
  }, 0);
}
