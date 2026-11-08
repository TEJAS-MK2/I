import type { KhataProposal } from "./proposal";

export type ProposalIssueCode =
  | "customer_required"
  | "amount_invalid"
  | "currency_required"
  | "item_quantity_invalid"
  | "item_name_required";

export type ProposalIssue = { code: ProposalIssueCode; field: string; message: string };
export type ProposalValidation = { valid: boolean; issues: ProposalIssue[] };

/**
 * Deterministic client-side completeness checks for a review proposal.
 * This is not an authorization or commit boundary; the server must revalidate.
 */
export function validateKhataProposal(proposal: KhataProposal): ProposalValidation {
  const issues: ProposalIssue[] = [];
  if (!proposal.customerName.trim()) {
    issues.push({ code: "customer_required", field: "customerName", message: "Choose or confirm a customer." });
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(proposal.amount) || Number(proposal.amount) <= 0) {
    issues.push({ code: "amount_invalid", field: "amount", message: "Enter an amount greater than zero with at most two decimal places." });
  }
  if (proposal.currency !== "INR") {
    issues.push({ code: "currency_required", field: "currency", message: "Confirm the currency before this proposal can proceed." });
  }
  proposal.items.forEach((item, index) => {
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(item.quantity) || Number(item.quantity) <= 0) {
      issues.push({ code: "item_quantity_invalid", field: `items.${index}.quantity`, message: "Enter a quantity greater than zero." });
    }
    if (!item.name.trim()) {
      issues.push({ code: "item_name_required", field: `items.${index}.name`, message: "Confirm the product name." });
    }
  });
  return { valid: issues.length === 0, issues };
}
