// Amount shown on an order tile: the finalized bill total once billed,
// otherwise a running estimate from whatever line prices have been entered
// so far (unavailable items always price at 0, same rule as bill finalize).
export type OrderAmountInput = {
  bill: { total: number } | null;
  items: { lineTotal: number | null; availability: string }[];
};

export function orderAmount(o: OrderAmountInput): number {
  if (o.bill) return o.bill.total;
  return o.items.reduce((sum, i) => sum + (i.availability === "UNAVAILABLE" ? 0 : i.lineTotal ?? 0), 0);
}
