export {}; // force module scope so this script's variables don't collide with other top-level scripts

import { assessOrderLikelihood } from "../src/lib/orderParsing";

type Case = { input: string; expectOrder: boolean; label: string };

const cases: Case[] = [
  { label: "typical multi-line order", input: "2 kg rice\n1 packet atta\ntoor dal 500g", expectOrder: true },
  { label: "comma-separated order", input: "rice, sugar, salt, milk", expectOrder: true },
  { label: "single item order", input: "2 kg onions", expectOrder: true },
  { label: "greeting only", input: "hi", expectOrder: false },
  { label: "hello variant", input: "Hiii!", expectOrder: false },
  { label: "thanks", input: "thank you", expectOrder: false },
  { label: "ok ack", input: "ok", expectOrder: false },
  { label: "emoji only", input: "👍", expectOrder: false },
  { label: "empty string", input: "", expectOrder: false },
  { label: "whitespace only", input: "   \n  ", expectOrder: false },
  { label: "question, not order", input: "when will you open today", expectOrder: false },
  { label: "short vague single word", input: "hello", expectOrder: false },
  { label: "single word item (ambiguous, no qty)", input: "milk", expectOrder: true },
  { label: "mixed greeting + items", input: "hi\n2 kg rice\n1 packet sugar", expectOrder: true },
  { label: "long rambling non-order sentence", input: "can you tell me if you have fresh vegetables today", expectOrder: false },
  { label: "short question, no qty", input: "do you have onions", expectOrder: false },
  { label: "are you open", input: "are you open today", expectOrder: false },
  { label: "bare item name no qty", input: "onions", expectOrder: true },
  { label: "two word item no qty", input: "toor dal", expectOrder: true },
  { label: "delivery address question", input: "can you deliver to Sector 12 today", expectOrder: false },
  { label: "polite long request with items buried", input: "please send 2kg rice and 1 packet sugar when you can", expectOrder: true },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = assessOrderLikelihood(c.input);
  const ok = result.isLikelyOrder === c.expectOrder;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] input=${JSON.stringify(c.input)} -> isLikelyOrder=${result.isLikelyOrder} reason="${result.reason}"`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);
if (fail > 0) process.exit(1);
