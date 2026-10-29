import { describe, expect, it } from "vitest";
import { parseRupeesToPaise, paiseToInput } from "../src/lib/currency";
import { parsePhone, isValidOtp } from "../src/lib/validation";

describe("money parsing uses integer paise", () => {
  it("parses whole and decimal rupees", () => {
    expect(parseRupeesToPaise("1500")).toBe(150000);
    expect(parseRupeesToPaise("1,250.50")).toBe(125050);
    expect(parseRupeesToPaise("0.1")).toBe(10);
  });
  it("rejects zero, negatives and junk", () => {
    expect(parseRupeesToPaise("0")).toBeNull();
    expect(parseRupeesToPaise("-5")).toBeNull();
    expect(parseRupeesToPaise("abc")).toBeNull();
    expect(parseRupeesToPaise("1.234")).toBeNull();
  });
  it("round-trips", () => {
    expect(paiseToInput(125050)).toBe("1250.50");
    expect(paiseToInput(150000)).toBe("1500");
  });
  it("adds amounts without floating point drift", () => {
    const total = [parseRupeesToPaise("0.1")!, parseRupeesToPaise("0.2")!].reduce((a, b) => a + b, 0);
    expect(total).toBe(30);
  });
});

describe("phone and OTP validation", () => {
  it("accepts a valid Indian mobile", () => {
    expect(parsePhone("IN", "98765 43210")).toEqual({ ok: true, e164: "+919876543210" });
  });
  it("rejects bad numbers", () => {
    expect(parsePhone("IN", "12345").ok).toBe(false);
    expect(parsePhone("IN", "5876543210").ok).toBe(false);
  });
  it("requires a 6-digit code", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
  });
});