export {}; // force module scope

import { orderAmount } from "../src/lib/orderAmount";

let pass = 0, fail = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} [${label}]`);
  ok ? pass++ : fail++;
}

check(
  "billed order shows the finalized bill total, not a re-sum of items",
  orderAmount({ bill: { total: 150 }, items: [{ lineTotal: 999, availability: "AVAILABLE" }] }) === 150
);
check(
  "unbilled order estimates from entered line totals",
  orderAmount({ bill: null, items: [{ lineTotal: 40, availability: "AVAILABLE" }, { lineTotal: 60, availability: "AVAILABLE" }] }) === 100
);
check(
  "unbilled order with an unavailable item excludes it from the estimate",
  orderAmount({ bill: null, items: [{ lineTotal: 40, availability: "AVAILABLE" }, { lineTotal: 60, availability: "UNAVAILABLE" }] }) === 40
);
check(
  "unbilled order with no prices entered yet estimates 0",
  orderAmount({ bill: null, items: [{ lineTotal: null, availability: "AVAILABLE" }] }) === 0
);
check("order with no items and no bill estimates 0", orderAmount({ bill: null, items: [] }) === 0);

console.log(`\n${pass} passed, ${fail} failed out of ${pass + fail}`);
if (fail > 0) process.exit(1);
