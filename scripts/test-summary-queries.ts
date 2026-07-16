export {}; // force module scope

import { receivedWhere, statusChangeWhere, openOrdersWhere, classifyLedgerEntries, isMoneyReceivedEntry, balanceDelta, sumBalanceDelta } from "../src/lib/summaryQueries";

// Regression test for a real bug: Cancelled was scoped to isLikelyOrder=true
// orders only, so a dismissed "Needs Review" message (status=CANCELLED,
// isLikelyOrder=false) silently didn't count even though it visibly shows
// CANCELLED in the Orders "All"/"Cancelled" tabs. Received/Delivered/Cancelled
// must all share the same universe (no isLikelyOrder filter) so the numbers
// reconcile with what the Orders list actually shows.

const storeId = "store-1";
const start = new Date("2026-07-01T00:00:00Z");
const end = new Date("2026-07-02T00:00:00Z");

let pass = 0, fail = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} [${label}]`);
  ok ? pass++ : fail++;
}

const received = receivedWhere(storeId, start, end);
check("received scopes to storeId and date range only", JSON.stringify(received) === JSON.stringify({ storeId, createdAt: { gte: start, lt: end } }));
check("received has no isLikelyOrder filter (counts flagged messages too)", !("isLikelyOrder" in received));

const cancelled = statusChangeWhere(storeId, start, end, "CANCELLED");
check("cancelled targets the right AuditLog detail suffix", (cancelled.detail as any).endsWith === "-> CANCELLED");
check("cancelled scopes order by storeId only, no isLikelyOrder filter", JSON.stringify(cancelled.order) === JSON.stringify({ storeId }));

const delivered = statusChangeWhere(storeId, start, end, "DELIVERED");
check("delivered targets the right AuditLog detail suffix", (delivered.detail as any).endsWith === "-> DELIVERED");
check("delivered scopes order by storeId only, no isLikelyOrder filter", JSON.stringify(delivered.order) === JSON.stringify({ storeId }));

const open = openOrdersWhere(storeId, start, end);
check("open scopes to storeId + date range + isLikelyOrder + not delivered/cancelled", JSON.stringify(open) === JSON.stringify({
  storeId, createdAt: { gte: start, lt: end }, isLikelyOrder: true, status: { notIn: ["DELIVERED", "CANCELLED"] },
}));

// Regression test for a real bug: moneyReceived/receivablesAdded were computed
// from Bill rows only, so a manual payment/amount-due (POST /api/ledger,
// no billId at all) moved totalOutstanding but never showed up in either
// figure - producing numbers that didn't reconcile with each other.
check(
  "bill-driven PAID entry counts as money received",
  isMoneyReceivedEntry({ amount: 120, billId: "b1", billPaymentStatus: "PAID" }) === true
);
check(
  "bill-driven CREDIT entry counts as receivable, not money received",
  isMoneyReceivedEntry({ amount: 300, billId: "b2", billPaymentStatus: "CREDIT" }) === false
);
check(
  "manual entry with negative amount (a payment) counts as money received",
  isMoneyReceivedEntry({ amount: -50, billId: null, billPaymentStatus: null }) === true
);
check(
  "manual entry with positive amount (a charge) counts as receivable",
  isMoneyReceivedEntry({ amount: 80, billId: null, billPaymentStatus: null }) === false
);

const mixedEntries = [
  { amount: 120, billId: "b1", billPaymentStatus: "PAID" }, // bill paid at delivery
  { amount: 300, billId: "b2", billPaymentStatus: "CREDIT" }, // bill on credit
  { amount: -50, billId: null, billPaymentStatus: null }, // manual payment received
  { amount: 80, billId: null, billPaymentStatus: null }, // manual amount due added
];
const mixed = classifyLedgerEntries(mixedEntries);
check("classifyLedgerEntries sums money received across bill + manual entries", mixed.moneyReceived === 170);
check("classifyLedgerEntries sums receivables added across bill + manual entries", mixed.receivablesAdded === 380);

// balanceDelta / sumBalanceDelta: the true effect on the running balance,
// which is NOT the same as "receivablesAdded - moneyReceived" - a bill paid
// immediately never touched the balance, so it must contribute 0 here even
// though it counts fully in moneyReceived above.
check("a bill paid immediately never touched the balance (delta 0)", balanceDelta({ amount: 120, billId: "b1", billPaymentStatus: "PAID" }) === 0);
check("a bill on credit adds its full amount to the balance", balanceDelta({ amount: 300, billId: "b2", billPaymentStatus: "CREDIT" }) === 300);
check("a manual payment reduces the balance by its (negative) amount", balanceDelta({ amount: -50, billId: null, billPaymentStatus: null }) === -50);
check("a manual charge increases the balance by its (positive) amount", balanceDelta({ amount: 80, billId: null, billPaymentStatus: null }) === 80);
check("sumBalanceDelta nets the same mixed set to the true balance movement", sumBalanceDelta(mixedEntries) === 330);

console.log(`\n${pass} passed, ${fail} failed out of ${pass + fail}`);
if (fail > 0) process.exit(1);
