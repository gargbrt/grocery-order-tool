export {}; // force module scope

import { getCategoryFilter, type OrderCategory } from "../src/lib/orderCategories";

// Regression test for the Orders-tab categorization (All/Open/Needs
// Review/Delivered/Cancelled) and the bug where a dismissed flagged message
// (isLikelyOrder=false, status=CANCELLED) used to linger in Needs Review
// forever because "review" didn't exclude CANCELLED.

type Case = { label: string; category: OrderCategory; expected: Record<string, unknown> };

const cases: Case[] = [
  { label: "all - no filter at all", category: "all", expected: {} },
  {
    label: "open - real orders, not delivered/cancelled",
    category: "open",
    expected: { isLikelyOrder: true, status: { notIn: ["DELIVERED", "CANCELLED"] } },
  },
  {
    label: "review - flagged messages, excludes CANCELLED (dismissed ones)",
    category: "review",
    expected: { isLikelyOrder: false, status: { not: "CANCELLED" } },
  },
  { label: "delivered - status only", category: "delivered", expected: { status: "DELIVERED" } },
  { label: "cancelled - status only", category: "cancelled", expected: { status: "CANCELLED" } },
  { label: "received - real orders, any status", category: "received", expected: { isLikelyOrder: true } },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = getCategoryFilter(c.category);
  const ok = JSON.stringify(result) === JSON.stringify(c.expected);
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] -> ${JSON.stringify(result)}`);
  ok ? pass++ : fail++;
}

// Specific regression check: a flagged-and-dismissed message must NOT match
// the "review" filter's intent (status excluded is CANCELLED).
const reviewFilter = getCategoryFilter("review") as { status: { not: string } };
const dismissedMessageStatus = "CANCELLED";
const stillNeedsReview = dismissedMessageStatus !== reviewFilter.status.not;
console.log(
  `${!stillNeedsReview ? "PASS" : "FAIL"} [dismissed flagged message excluded from Needs Review] -> excluded=${!stillNeedsReview}`
);
!stillNeedsReview ? pass++ : fail++;

console.log(`\n${pass} passed, ${fail} failed out of ${cases.length + 1}`);
if (fail > 0) process.exit(1);
