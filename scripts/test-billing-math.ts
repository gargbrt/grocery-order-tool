export {}; // force module scope so this script's variables don't collide with other top-level scripts

// Re-implements (verbatim) the calculation logic from src/app/api/bills/route.ts

type Item = { lineTotal: number | null };

function computeBill(items: Item[], discount: number) {
  const subtotal = items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0);
  const total = Math.max(subtotal - discount, 0);
  return { subtotal, total };
}

function computeLedger(previousBalance: number, total: number, markPaid: boolean) {
  const delta = markPaid ? 0 : total;
  return previousBalance + delta;
}

type Case = {
  label: string;
  items: Item[];
  discount: number;
  previousBalance: number;
  markPaid: boolean;
  expectedTotal: number;
  expectedBalance: number;
};

const cases: Case[] = [
  { label: "simple unpaid order, no prior balance", items: [{ lineTotal: 100 }, { lineTotal: 50 }], discount: 0, previousBalance: 0, markPaid: false, expectedTotal: 150, expectedBalance: 150 },
  { label: "same order marked paid immediately - should NOT add to balance", items: [{ lineTotal: 100 }, { lineTotal: 50 }], discount: 0, previousBalance: 0, markPaid: true, expectedTotal: 150, expectedBalance: 0 },
  { label: "with discount", items: [{ lineTotal: 200 }], discount: 30, previousBalance: 0, markPaid: false, expectedTotal: 170, expectedBalance: 170 },
  { label: "discount larger than subtotal - total should floor at 0, not go negative", items: [{ lineTotal: 50 }], discount: 100, previousBalance: 0, markPaid: false, expectedTotal: 0, expectedBalance: 0 },
  { label: "existing credit balance, new unpaid order adds on top", items: [{ lineTotal: 80 }], discount: 0, previousBalance: 220, markPaid: false, expectedTotal: 80, expectedBalance: 300 },
  { label: "existing credit balance, this order paid - balance unchanged", items: [{ lineTotal: 80 }], discount: 0, previousBalance: 220, markPaid: true, expectedTotal: 80, expectedBalance: 220 },
  { label: "item with null lineTotal (price never entered) treated as 0, not crash", items: [{ lineTotal: 100 }, { lineTotal: null }], discount: 0, previousBalance: 0, markPaid: false, expectedTotal: 100, expectedBalance: 100 },
  { label: "empty items array", items: [], discount: 0, previousBalance: 50, markPaid: false, expectedTotal: 0, expectedBalance: 50 },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const { subtotal, total } = computeBill(c.items, c.discount);
  const balance = computeLedger(c.previousBalance, total, c.markPaid);
  const ok = total === c.expectedTotal && balance === c.expectedBalance;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] subtotal=${subtotal} total=${total} (expected ${c.expectedTotal}) balance=${balance} (expected ${c.expectedBalance})`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);
if (fail > 0) process.exit(1);
