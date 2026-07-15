export {}; // force module scope

import { extractErrorMessage } from "../src/lib/errors";

// Regression test for the signup-crash bug: a zod .flatten() error with
// fieldErrors populated but formErrors empty used to fall through to
// rendering the raw object as a React child. See src/lib/errors.ts.

type Case = { label: string; body: unknown; fallback: string; expected: string };

const cases: Case[] = [
  {
    label: "plain string error",
    body: { error: "Invalid phone or password" },
    fallback: "fallback",
    expected: "Invalid phone or password",
  },
  {
    label: "zod error with only fieldErrors (the actual crash case)",
    body: { error: { formErrors: [], fieldErrors: { storeName: ["String must contain at least 2 character(s)"] } } },
    fallback: "fallback",
    expected: "String must contain at least 2 character(s)",
  },
  {
    label: "zod error with formErrors populated",
    body: { error: { formErrors: ["Top-level form error"], fieldErrors: {} } },
    fallback: "fallback",
    expected: "Top-level form error",
  },
  {
    label: "zod error with multiple fieldErrors keys - picks first non-empty",
    body: { error: { formErrors: [], fieldErrors: { a: [], b: ["Second field error"] } } },
    fallback: "fallback",
    expected: "Second field error",
  },
  {
    label: "empty body - falls back",
    body: {},
    fallback: "fallback",
    expected: "fallback",
  },
  {
    label: "null body - falls back",
    body: null,
    fallback: "fallback",
    expected: "fallback",
  },
  {
    label: "error object with no usable messages - falls back",
    body: { error: { formErrors: [], fieldErrors: {} } },
    fallback: "fallback",
    expected: "fallback",
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = extractErrorMessage(c.body, c.fallback);
  const ok = result === c.expected;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.label}] -> ${JSON.stringify(result)} (expected ${JSON.stringify(c.expected)})`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed out of ${cases.length}`);
if (fail > 0) process.exit(1);
