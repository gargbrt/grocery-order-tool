// Extracts a displayable string from an API error response body. Handles
// three shapes we actually return: a plain string, a zod .flatten() object
// ({ formErrors: string[], fieldErrors: Record<string, string[]> }), or
// nothing at all. Zod puts most validation errors under fieldErrors, not
// formErrors, so a naive `body.error?.formErrors?.[0] || body.error` falls
// through to rendering the raw object as a React child and crashes.
export function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const error = (body as { error?: unknown }).error;

  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const flattened = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    if (flattened.formErrors?.[0]) return flattened.formErrors[0];
    const firstFieldError = Object.values(flattened.fieldErrors ?? {}).find((msgs) => msgs?.length);
    if (firstFieldError?.[0]) return firstFieldError[0];
  }
  return fallback;
}
