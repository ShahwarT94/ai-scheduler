/**
 * Lightweight input validators for Lambda handlers.
 *
 * Each function returns an error message string on failure, or null on success.
 * Callers pattern:
 *   const err = v.requireDate(date, "date");
 *   if (err) return badRequest(err);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** null = valid, string = error message */
type ValidationError = string | null;

// ─── String ───────────────────────────────────────────────────────────────────

/**
 * Field must be a non-empty string containing only word characters and hyphens.
 * Rejects whitespace-only values, injection characters, and values over maxLength.
 */
export function requireId(
  value: unknown,
  field: string,
  maxLength = 64
): ValidationError {
  if (value === undefined || value === null || value === "")
    return `${field} is required`;
  if (typeof value !== "string")
    return `${field} must be a string`;
  if (value.trim() === "")
    return `${field} must not be blank`;
  if (!/^[\w-]+$/.test(value))
    return `${field} must contain only letters, numbers, underscores, and hyphens`;
  if (value.length > maxLength)
    return `${field} must be ${maxLength} characters or fewer`;
  return null;
}

// ─── Date ─────────────────────────────────────────────────────────────────────

/**
 * Field must be a string in YYYY-MM-DD format with a real calendar date.
 * Rejects month > 12, day > 31, and non-date strings that match the regex.
 */
export function requireDate(value: unknown, field: string): ValidationError {
  if (!value) return `${field} is required (YYYY-MM-DD)`;
  if (typeof value !== "string") return `${field} must be a string`;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return `${field} must be in YYYY-MM-DD format`;

  const [, mm, dd] = value.split("-").map(Number);
  if (mm < 1 || mm > 12) return `${field} has an invalid month (${mm})`;
  if (dd < 1 || dd > 31) return `${field} has an invalid day (${dd})`;

  return null;
}

/** Same as requireDate but only validates when the value is present. */
export function optionalDate(value: unknown, field: string): ValidationError {
  if (value === undefined || value === null || value === "") return null;
  return requireDate(value, field);
}

// ─── Time ─────────────────────────────────────────────────────────────────────

/**
 * Field must be HH:MM in 24-hour format with valid hour (0–23) and minute (0–59).
 */
export function requireTime(value: unknown, field: string): ValidationError {
  if (!value) return `${field} is required (HH:MM)`;
  if (typeof value !== "string") return `${field} must be a string`;

  if (!/^\d{2}:\d{2}$/.test(value))
    return `${field} must be in HH:MM format`;

  const [hh, mm] = value.split(":").map(Number);
  if (hh > 23) return `${field} has an invalid hour (${hh})`;
  if (mm > 59) return `${field} has an invalid minute (${mm})`;

  return null;
}

/** Same as requireTime but only validates when the value is present. */
export function optionalTime(value: unknown, field: string): ValidationError {
  if (value === undefined || value === null || value === "") return null;
  return requireTime(value, field);
}

// ─── Enum ─────────────────────────────────────────────────────────────────────

/** Field must be one of the allowed values. */
export function requireEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): ValidationError {
  if (value === undefined || value === null || value === "")
    return `${field} is required`;
  if (!allowed.includes(value as T))
    return `${field} must be one of: ${allowed.join(", ")}`;
  return null;
}

/** Same as requireEnum but only validates when the value is present. */
export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): ValidationError {
  if (value === undefined || value === null || value === "") return null;
  return requireEnum(value, field, allowed);
}

// ─── Number ───────────────────────────────────────────────────────────────────

/**
 * Field must be a positive integer within the given range.
 * Also rejects values that are numbers in JSON but not integers (e.g. 1.5).
 */
export function requirePositiveInt(
  value: unknown,
  field: string,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): ValidationError {
  if (value === undefined || value === null)
    return `${field} is required`;
  if (typeof value !== "number" || !Number.isInteger(value))
    return `${field} must be an integer`;
  if (value < min || value > max)
    return `${field} must be between ${min} and ${max}`;
  return null;
}

// ─── JSON body ────────────────────────────────────────────────────────────────

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Safely parses a JSON request body.
 * Returns { ok: false } with a human-readable error on malformed JSON,
 * instead of throwing and producing a 500.
 */
export function parseJsonBody<T>(
  raw: string | null | undefined
): ParseResult<T> {
  if (!raw) return { ok: false, error: "Request body is required" };
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "Request body must be valid JSON" };
  }
}
