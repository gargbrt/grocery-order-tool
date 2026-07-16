export {}; // force module scope

import { totalOrderValue, totalOrderValueInRange } from "../src/lib/customerValue";

type Case = { label: string; orders: { bill: { total: number } | null }[]; expected: number };

const cases: Case[] = [
  { label: "no orders", orders: [], expected: 0 },
  { label: "single billed order", orders: [{ bill: { total: 120 } }], expected: 120 },
  {
    label: "multiple billed orders sum up",
    orders: [{ bill: { total: 100 } }, { bill: { total: 50 } }, { bill: { total: 25.5 } }],
    expected: 175.5,
  },
  {
    label: "unbilled order (no bill yet) counts as 0, doesn't crash",
    orders: [{ bill: { total: 80 } }, { bill: null }],
    expected: 80,
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = totalOrderValue(c.orders);
  const ok = result === c.expected;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] -> ${result} (expected ${c.expected})`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);

const start = new Date("2026-07-01T00:00:00Z");
const end = new Date("2026-07-02T00:00:00Z");

function checkRange(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} [${label}]`);
  ok ? pass++ : fail++;
}

checkRange(
  "totalOrderValueInRange only counts bills finalized inside the range",
  totalOrderValueInRange(
    [
      { bill: { total: 100, finalizedAt: new Date("2026-07-01T12:00:00Z") } }, // inside
      { bill: { total: 50, finalizedAt: new Date("2026-06-30T23:59:59Z") } }, // before range
      { bill: { total: 25, finalizedAt: new Date("2026-07-02T00:00:00Z") } }, // exactly at exclusive end
    ],
    start,
    end
  ) === 100
);
checkRange("totalOrderValueInRange treats an unbilled order as 0, doesn't crash", totalOrderValueInRange([{ bill: null }], start, end) === 0);

if (fail > 0) process.exit(1);
