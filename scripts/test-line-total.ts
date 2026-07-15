export {}; // force module scope so this script's variables don't collide with other top-level scripts

// Verbatim copy of the lineTotal formula from src/app/api/orders/[id]/route.ts.
//
// Changed from "unitPrice * parsedQuantity" to just "amount entered" - the
// owner types the total for the whole line directly (e.g. ₹120 for "2 kg" of
// something) instead of a per-unit rate they'd have to mentally multiply.
// quantityFulfilled is still recorded but no longer feeds into this formula.

function lineTotal(amount: number, availability?: string) {
  return availability === "UNAVAILABLE" ? 0 : amount;
}

const cases: { label: string; amount: number; availability?: string; expected: number }[] = [
  { label: "amount entered directly, no multiplication", amount: 120, expected: 120 },
  { label: "zero amount entered - bills 0, not treated as unset", amount: 0, expected: 0 },
  { label: "decimal amount", amount: 89.5, expected: 89.5 },
  { label: "unavailable item always bills 0 regardless of amount entered", amount: 120, availability: "UNAVAILABLE", expected: 0 },
  { label: "available item bills the entered amount", amount: 60, availability: "AVAILABLE", expected: 60 },
  { label: "substituted item bills the entered amount", amount: 45, availability: "SUBSTITUTED", expected: 45 },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = lineTotal(c.amount, c.availability);
  const ok = result === c.expected;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] amount=${c.amount} availability=${c.availability ?? "PENDING"} -> ${result} (expected ${c.expected})`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);
if (fail > 0) process.exit(1);
