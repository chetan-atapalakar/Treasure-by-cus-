/** All money is integer paise (₹1 = 100 paise). Never use floats for stored amounts. */

export function formatINR(paise: number): string {
  const whole = paise % 100 === 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function compactINR(paise: number): string {
  const r = Math.round(paise / 100);
  if (r >= 100000) return `₹${(r / 100000).toFixed(r % 100000 === 0 ? 0 : 1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(r % 1000 === 0 ? 0 : 1)}K`;
  return `₹${r}`;
}

/** Parses "1,250.50" / "₹1500" into integer paise. Returns null when invalid. */
export function parseRupeesToPaise(input: string, opts: { allowZero?: boolean } = {}): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  if (whole.length > 9) return null; // keeps amounts below ₹100 crore
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (paise === 0 && !opts.allowZero) return null;
  return paise;
}

export function paiseToInput(paise: number): string {
  const whole = Math.floor(paise / 100);
  const frac = paise % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}