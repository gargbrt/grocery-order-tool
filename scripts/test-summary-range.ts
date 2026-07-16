export {}; // force module scope

import { getRange, parsePeriod } from "../src/lib/summaryRange";

let pass = 0, fail = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} [${label}]`);
  ok ? pass++ : fail++;
}

// IMPORTANT: these assertions read calendar-day components via IST-shifted
// UTC getters (not local .getFullYear()/.getMonth()/.getDate()), exactly
// like the implementation does. That's deliberate - it means these tests
// pass identically whether they run on a machine set to IST, UTC, or
// anything else, which is the whole point of the fix being tested: date
// boundaries must not depend on the process's own local timezone.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), date: shifted.getUTCDate(), day: shifted.getUTCDay() };
}

check("parsePeriod accepts a known value", parsePeriod("weekly") === "weekly");
check("parsePeriod falls back to daily for garbage input", parsePeriod("nonsense") === "daily");
check("parsePeriod falls back to daily for null", parsePeriod(null) === "daily");
check("parsePeriod accepts the new fy/all/custom values", parsePeriod("fy") === "fy" && parsePeriod("all") === "all" && parsePeriod("custom") === "custom");

const daily = getRange("daily");
check("daily range spans exactly 24 hours", daily.end.getTime() - daily.start.getTime() === 24 * 60 * 60 * 1000);
check("daily range starts at IST midnight (5:30 UTC-offset from a whole day)", (daily.start.getTime() + IST_OFFSET_MS) % (24 * 60 * 60 * 1000) === 0);

const weekly = getRange("weekly");
check("weekly range spans exactly 7 days", weekly.end.getTime() - weekly.start.getTime() === 7 * 24 * 60 * 60 * 1000);
check("weekly range starts on an IST Monday", istParts(weekly.start).day === 1);

const monthly = getRange("monthly");
check("monthly range starts on the 1st (IST calendar)", istParts(monthly.start).date === 1);
check(
  "monthly range covers the current IST calendar month only",
  istParts(monthly.start).month === istParts(new Date()).month && istParts(monthly.start).year === istParts(new Date()).year
);

const all = getRange("all");
check("all/overall starts from the epoch", all.start.getTime() === 0);
check("all/overall ends after now", all.end.getTime() > Date.now());

const fySummer = getRange("fy", undefined);
const nowIst = istParts(new Date());
const expectedFyStartYear = nowIst.month >= 3 ? nowIst.year : nowIst.year - 1;
check(
  "financial year starts April 1 (IST calendar)",
  istParts(fySummer.start).year === expectedFyStartYear && istParts(fySummer.start).month === 3 && istParts(fySummer.start).date === 1
);
check(
  "financial year ends April 1 of the following year (IST calendar)",
  istParts(fySummer.end).year === expectedFyStartYear + 1 && istParts(fySummer.end).month === 3 && istParts(fySummer.end).date === 1
);

const custom = getRange("custom", { start: "2026-01-01", end: "2026-01-31" });
check(
  "custom range starts at IST midnight of the given start date, not UTC midnight",
  istParts(custom.start).year === 2026 && istParts(custom.start).month === 0 && istParts(custom.start).date === 1
);
check(
  "custom range end is the day after the given end date (so Jan 31 is fully included)",
  istParts(custom.end).year === 2026 && istParts(custom.end).month === 1 && istParts(custom.end).date === 1
);

console.log(`\n${pass} passed, ${fail} failed out of ${pass + fail}`);
if (fail > 0) process.exit(1);
