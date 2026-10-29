export interface Country {
  code: string;
  name: string;
  dial: string;
  /** Allowed national-number lengths (digits). */
  lengths: number[];
}

export const COUNTRIES: Country[] = [
  { code: "IN", name: "India", dial: "+91", lengths: [10] },
  { code: "US", name: "United States", dial: "+1", lengths: [10] },
  { code: "GB", name: "United Kingdom", dial: "+44", lengths: [10] },
  { code: "AE", name: "United Arab Emirates", dial: "+971", lengths: [9] },
  { code: "SG", name: "Singapore", dial: "+65", lengths: [8] },
];

export type PhoneParse = { ok: true; e164: string } | { ok: false; error: string };

export function parsePhone(countryCode: string, raw: string): PhoneParse {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return { ok: false, error: "Choose a country code." };

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 0) return { ok: false, error: "Enter your mobile number." };

  if (!country.lengths.includes(digits.length)) {
    const need = country.lengths.join(" or ");
    return { ok: false, error: `Enter a valid ${need}-digit mobile number for ${country.name}.` };
  }
  if (country.code === "IN" && !/^[6-9]/.test(digits)) {
    return { ok: false, error: "Indian mobile numbers start with 6, 7, 8 or 9." };
  }
  return { ok: true, e164: `${country.dial}${digits}` };
}

export function isValidOtp(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function maskPhone(e164: string): string {
  const tail = e164.slice(-4);
  const head = e164.slice(0, -4).replace(/\d/g, "•");
  return `${head}${tail}`;
}