/**
 * CüS Treasure — Date Utilities
 * Handles date formatting, validation and calculations.
 */

/**
 * Convert a Date object to YYYY-MM-DD format.
 */
export function toISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD into a local Date object.
 */
export function parseISO(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return new Date(NaN);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return new Date(NaN);
  }

  return date;
}

/**
 * Add or subtract days from a date.
 */
export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);

  return result;
}

/**
 * Return today's date as YYYY-MM-DD.
 */
export function todayISO(): string {
  return toISO(new Date());
}

/**
 * Check whether a string is a valid ISO calendar date.
 */
export function isValidISODate(value: string): boolean {
  return !Number.isNaN(parseISO(value).getTime());
}

/**
 * Format a date as 29 Oct.
 */
export function shortDate(value: string): string {
  const date = parseISO(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Format a date as 29 Oct 2026.
 */
export function fullDate(value: string): string {
  const date = parseISO(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date using the shortDate function.
 * Compatibility helper for components that expect formatDate.
 */
export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : parseISO(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return shortDate(toISO(date));
}