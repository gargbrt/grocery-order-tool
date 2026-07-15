export {}; // force module scope

import { parseOrderLine } from "../src/lib/orderParsing";

// Regression test for splitting quantity+unit off the item name so billing
// shows a clean item name ("qwe") instead of the whole raw line ("2 kg qwe").

type Case = { label: string; input: string; expectedQty: string; expectedName: string };

const cases: Case[] = [
  { label: "leading quantity+unit", input: "2 kg qwe", expectedQty: "2 kg", expectedName: "qwe" },
  { label: "leading quantity, no space before unit", input: "2kg rice", expectedQty: "2kg", expectedName: "rice" },
  { label: "leading decimal quantity", input: "1.5 litre oil", expectedQty: "1.5 litre", expectedName: "oil" },
  { label: "leading packet unit", input: "1 packet atta", expectedQty: "1 packet", expectedName: "atta" },
  { label: "trailing quantity+unit, attached", input: "toor dal 500g", expectedQty: "500g", expectedName: "toor dal" },
  { label: "trailing quantity+unit, multi-word item", input: "basmati rice 2 kg", expectedQty: "2 kg", expectedName: "basmati rice" },
  { label: "no quantity at all - whole line is the item name", input: "onions", expectedQty: "", expectedName: "onions" },
  { label: "two-word item, no quantity", input: "toor dal", expectedQty: "", expectedName: "toor dal" },
  { label: "number present but not a recognized unit - left alone", input: "2 apples", expectedQty: "", expectedName: "2 apples" },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = parseOrderLine(c.input);
  const ok = result.quantityRequested === c.expectedQty && result.itemName === c.expectedName;
  console.log(
    `${ok ? "PASS" : "FAIL"} [${c.label}] input=${JSON.stringify(c.input)} -> qty=${JSON.stringify(result.quantityRequested)} name=${JSON.stringify(result.itemName)} (expected qty=${JSON.stringify(c.expectedQty)} name=${JSON.stringify(c.expectedName)})`
  );
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);
if (fail > 0) process.exit(1);
