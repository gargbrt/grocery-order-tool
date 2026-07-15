export {}; // force module scope

import { isOverdue, OVERDUE_DAYS } from "../src/lib/ledgerOverdue";

const now = new Date("2026-07-15T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

type Case = { label: string; balance: number; lastActivityAt: Date | string | null; expected: boolean };

const cases: Case[] = [
  { label: "balance is 0 - never overdue regardless of age", balance: 0, lastActivityAt: daysAgo(100), expected: false },
  { label: "negative balance (store owes customer) - never overdue", balance: -50, lastActivityAt: daysAgo(100), expected: false },
  { label: "positive balance, no activity recorded at all", balance: 100, lastActivityAt: null, expected: false },
  { label: `positive balance, activity ${OVERDUE_DAYS + 1} days ago - overdue`, balance: 100, lastActivityAt: daysAgo(OVERDUE_DAYS + 1), expected: true },
  { label: `positive balance, activity exactly ${OVERDUE_DAYS} days ago - not yet overdue`, balance: 100, lastActivityAt: daysAgo(OVERDUE_DAYS), expected: false },
  { label: "positive balance, activity 1 day ago - not overdue", balance: 100, lastActivityAt: daysAgo(1), expected: false },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = isOverdue(c.balance, c.lastActivityAt, now);
  const ok = result === c.expected;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] -> ${result} (expected ${c.expected})`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);
if (fail > 0) process.exit(1);
