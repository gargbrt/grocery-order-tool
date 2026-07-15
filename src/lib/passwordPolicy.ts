// Single source of truth for the password rule, used by both the zod schemas
// (server-side enforcement) and the UI hint text, so they can never drift.
export const MIN_PASSWORD_LENGTH = 4;
export const PASSWORD_REQUIREMENTS_TEXT = `At least ${MIN_PASSWORD_LENGTH} characters. No other requirements (no forced uppercase/numbers/symbols).`;
