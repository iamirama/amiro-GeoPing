/**
 * Persian (fa-IR) locale helpers.
 */

const faNumberFormatter = new Intl.NumberFormat("fa-IR");
const faNumberFormatterEn = new Intl.NumberFormat("en-US");

/** Format an integer/float with Persian digits, e.g. 1234 → "۱٬۲۳۴". */
export function formatFa(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return faNumberFormatter.format(value);
}

/** Format a number with Latin digits (still grouped). */
export function formatEn(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return faNumberFormatterEn.format(value);
}

/** Round to N decimals and return Persian digits, with unit suffix. */
export function formatMs(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const fixed = value.toFixed(decimals);
  return `${faNumberFormatter.format(Number(fixed))} ms`;
}

/** Convert ASCII digits in a string to Persian digits. */
export function toFaDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}

/** Convert Persian/Arabic digits in a string to ASCII digits. */
export function toEnDigits(s: string): string {
  return s
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Convert ISO 8601 to a short Persian date-time string. */
export function formatTimestamp(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(d);
  } catch {
    return iso;
  }
}
