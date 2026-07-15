export {}; // force module scope so this script's variables don't collide with other top-level scripts

// Verbatim copy of the FIXED lineTotal formula from src/app/api/orders/[id]/route.ts.

function lineTotal(unitPrice: number, quantityFulfilled: string | undefined, availability?: string) {
  const parsedQty = quantityFulfilled ? parseFloat(quantityFulfilled) : NaN;
  const qty = Number.isNaN(parsedQty) ? 1 : parsedQty;
  return availability === "UNAVAILABLE" ? 0 : unitPrice * qty;
}

const cases: { label: string; unitPrice: number; qty: string | undefined; availability?: string; expected: number }[] = [
  { label: "clean integer qty", unitPrice: 50, qty: "2", expected: 100 },
  { label: "decimal qty (kg)", unitPrice: 60, qty: "1.5", expected: 90 },
  { label: "empty qty -> defaults to 1", unitPrice: 40, qty: "", expected: 40 },
  { label: "undefined qty -> defaults to 1", unitPrice: 40, qty: undefined, expected: 40 },
  { label: "qty with unit text 'kg' - parseFloat reads leading number", unitPrice: 60, qty: "2 kg", expected: 120 },
  { label: "qty is non-numeric text - falls back to 1 (not 0 or NaN)", unitPrice: 40, qty: "a few", expected: 40 },
  { label: "qty is explicit zero - correctly bills 0, not 1", unitPrice: 40, qty: "0", expected: 0 },
  { label: "qty has leading space", unitPrice: 40, qty: "  3", expected: 120 },
  { label: "unavailable item always bills 0 regardless of qty/price entered", unitPrice: 40, qty: "2", availability: "UNAVAILABLE", expected: 0 },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = lineTotal(c.unitPrice, c.qty, c.availability);
  const ok = result === c.expected;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] unitPrice=${c.unitPrice} qty=${JSON.stringify(c.qty)} -> ${result} (expected ${c.expected})`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);
if (fail > 0) process.exit(1);
