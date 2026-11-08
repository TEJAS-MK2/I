import { describe, expect, it } from "vitest";
import { parseKhataUtterance } from "./proposal";
import { validateKhataProposal } from "./transactionValidation";

describe("khata proposal validation", () => {
  it("blocks a colloquial amount until currency is confirmed", () => {
    const proposal = parseKhataUtterance("Ramesh 150 taka udhar, 2 kg sugar");
    expect(proposal).not.toBeNull();
    expect(validateKhataProposal(proposal!).issues.map(issue => issue.code)).toContain("currency_required");
  });

  it("accepts a structurally complete INR proposal for server review", () => {
    const proposal = parseKhataUtterance("Ramesh ₹150 udhar, 2 kg sugar");
    expect(proposal).not.toBeNull();
    expect(validateKhataProposal(proposal!).valid).toBe(true);
  });

  it("rejects zero, negative and over-precision amounts", () => {
    const base = parseKhataUtterance("Ramesh ₹150 udhar");
    expect(base).not.toBeNull();
    for (const amount of ["0", "-1", "1.234", "abc"]) {
      expect(validateKhataProposal({ ...base!, amount }).valid).toBe(false);
    }
  });
});
