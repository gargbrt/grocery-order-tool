// Shared by /api/summary and /api/summary/entries so both routes always
// agree on what date range a given period means.
export type Period = "daily" | "weekly" | "monthly" | "fy" | "all" | "custom";

export const VALID_PERIODS: Period[] = ["daily", "weekly", "monthly", "fy", "all", "custom"];

export function parsePeriod(value: string | null): Period {
  return value && (VALID_PERIODS as string[]).includes(value) ? (value as Period) : "daily";
}

// All ranges are calendar boundaries in India Standard Time (UTC+5:30, no
// DST) - deliberately NOT the server process's own local timezone. Using
// `new Date().getFullYear()/getMonth()/getDate()` would compute "today"
// using whatever timezone the Node process happens to be running in; that
// works by coincidence on a dev machine set to IST, but most hosting
// platforms default their containers to UTC, which would silently shift the
// day boundary by 5.5 hours - showing yesterday evening's IST activity as
// "today", or hiding today's morning activity, depending on time of day.
// Since this app is India-specific (README, +91 defaults, Apr-Mar financial
// year), every range is pinned to IST regardless of where it runs.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function addDaysUtc(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// The UTC instant corresponding to IST midnight on the IST calendar day that
// `at` falls in.
function istMidnightUtc(at: Date): Date {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - IST_OFFSET_MS);
}

// Parse a plain "YYYY-MM-DD" string (from a <input type="date">) as an IST
// calendar date - NOT `new Date("YYYY-MM-DD")`, which the ES spec parses as
// UTC midnight (5:30am IST, not midnight IST).
function parseIstDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1) - IST_OFFSET_MS);
}

// Indian financial year: April 1 - March 31 IST. If today (IST) is Jan-Mar,
// the FY started in April of the previous calendar year.
function financialYearRange(now: Date): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  const istMonth = shifted.getUTCMonth(); // 0-indexed IST calendar month
  const istYear = shifted.getUTCFullYear();
  const fyStartYear = istMonth >= 3 /* April */ ? istYear : istYear - 1;
  return {
    start: new Date(Date.UTC(fyStartYear, 3, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(fyStartYear + 1, 3, 1) - IST_OFFSET_MS),
  };
}

export function getRange(
  period: Period,
  custom?: { start?: string | null; end?: string | null }
): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = istMidnightUtc(now);

  if (period === "daily") {
    return { start: todayStart, end: addDaysUtc(todayStart, 1) };
  }

  if (period === "weekly") {
    const shifted = new Date(now.getTime() + IST_OFFSET_MS);
    const day = shifted.getUTCDay(); // 0 = Sunday, IST calendar day-of-week
    const diffToMonday = (day + 6) % 7;
    const weekStart = addDaysUtc(todayStart, -diffToMonday);
    return { start: weekStart, end: addDaysUtc(weekStart, 7) };
  }

  if (period === "monthly") {
    const shifted = new Date(now.getTime() + IST_OFFSET_MS);
    const y = shifted.getUTCFullYear();
    const m = shifted.getUTCMonth();
    return {
      start: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS),
      end: new Date(Date.UTC(y, m + 1, 1) - IST_OFFSET_MS),
    };
  }

  if (period === "fy") return financialYearRange(now);

  if (period === "all") {
    // Store creation predates this app's own existence, so any far-past date
    // works as "everything so far" - `new Date(0)` is 1970, safely before
    // any real order.
    return { start: new Date(0), end: addDaysUtc(todayStart, 1) };
  }

  // custom - end date is inclusive, so the range extends to the day after it.
  const start = custom?.start ? parseIstDateOnly(custom.start) : new Date(0);
  const endDateOnly = custom?.end ? parseIstDateOnly(custom.end) : todayStart;
  return { start, end: addDaysUtc(endDateOnly, 1) };
}
