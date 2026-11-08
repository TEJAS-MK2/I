import { describe, expect, it } from "vitest";
import { rupeesToPaise, validateCreditSale, type CreditSaleCommand } from "./transaction";

const valid: CreditSaleCommand = {
  businessId: "123e4567-e89b-42d3-a456-426614174000",
  customerId: "123e4567-e89b-42d3-a456-426614174001",
  amountPaise: 30000,
  currency: "INR",
  idempotencyKey: "voice-proposal-2026-0001",
  confirmed: true,
  items: [{ productId: "123e4567-e89b-42d3-a456-426614174002", quantity: "2", unitPricePaise: 15000 }],
};

describe("money and credit-sale domain", () => {
  it("converts rupees to integer paise without float rounding", () => {
    expect(rupeesToPaise("150")).toBe(15000);
    expect(rupeesToPaise("0.10")).toBe(10);
    expect(rupeesToPaise("12.3")).toBe(1230);
    expect(rupeesToPaise("1.234")).toBeNull();
    expect(rupeesToPaise("-1")).toBeNull();
  });

  it("accepts a confirmed, exactly balanced INR sale", () => {
    expect(validateCreditSale(valid)).toEqual([]);
  });

  it("requires explicit user confirmation", () => {
    expect(validateCreditSale({ ...valid, confirmed: false }).map(x => x.code)).toContain("confirmation_required");
  });

  it("rejects floating-point money, unknown currency and unsafe idempotency keys", () => {
    const issues = validateCreditSale({ ...valid, amountPaise: 300.5, currency: "USD" as "INR", idempotencyKey: "x" });
    expect(issues.map(x => x.code)).toEqual(expect.arrayContaining(["invalid_amount", "invalid_currency", "invalid_idempotency_key"]));
  });

  it("requires the amount to match all item lines exactly", () => {
    expect(validateCreditSale({ ...valid, amountPaise: 30001 }).map(x => x.code)).toContain("amount_mismatch");
  });

  it("rejects zero quantities and non-integer paise prices", () => {
    const issues = validateCreditSale({ ...valid, items: [{ ...valid.items[0], quantity: "0", unitPricePaise: 12.5 }] });
    expect(issues.map(x => x.code)).toEqual(expect.arrayContaining(["invalid_quantity", "invalid_unit_price"]));
  });
});
