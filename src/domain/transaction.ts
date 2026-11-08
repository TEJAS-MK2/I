export type CurrencyCode = "INR";
export type TransactionItemInput = {
  productId: string;
  quantity: string;
  unitPricePaise: number;
};
export type CreditSaleCommand = {
  businessId: string;
  customerId: string;
  amountPaise: number;
  currency: CurrencyCode;
  idempotencyKey: string;
  confirmed: boolean;
  items: TransactionItemInput[];
};

export type DomainIssue = {
  code: "confirmation_required" | "invalid_amount" | "invalid_currency" | "invalid_idempotency_key" | "missing_items" | "invalid_quantity" | "invalid_unit_price" | "amount_mismatch" | "invalid_identifier";
  field: string;
  message: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;

function decimalToMilli(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
}

/** Convert rupees to integer paise without floating-point arithmetic. */
export function rupeesToPaise(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [rupees, fraction = ""] = normalized.split(".");
  const paise = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, "0"));
  return paise <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(paise) : null;
}

export function validateCreditSale(command: CreditSaleCommand): DomainIssue[] {
  const issues: DomainIssue[] = [];
  if (!command.confirmed) issues.push({ code: "confirmation_required", field: "confirmed", message: "The user must explicitly confirm the reviewed transaction." });
  if (!UUID.test(command.businessId)) issues.push({ code: "invalid_identifier", field: "businessId", message: "A valid business identifier is required." });
  if (!UUID.test(command.customerId)) issues.push({ code: "invalid_identifier", field: "customerId", message: "A valid customer identifier is required." });
  if (!Number.isSafeInteger(command.amountPaise) || command.amountPaise <= 0) issues.push({ code: "invalid_amount", field: "amountPaise", message: "Amount must be a positive integer number of paise." });
  if (command.currency !== "INR") issues.push({ code: "invalid_currency", field: "currency", message: "Only explicitly confirmed INR is supported in this release." });
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(command.idempotencyKey)) issues.push({ code: "invalid_idempotency_key", field: "idempotencyKey", message: "Use a stable idempotency key between 16 and 128 safe characters." });
  if (!Array.isArray(command.items) || command.items.length === 0 || command.items.length > 50) issues.push({ code: "missing_items", field: "items", message: "A credit sale must contain between 1 and 50 confirmed items." });

  let totalPaise = 0n;
  command.items.forEach((item, index) => {
    if (!UUID.test(item.productId)) issues.push({ code: "invalid_identifier", field: `items.${index}.productId`, message: "A valid product identifier is required." });
    const validQuantity = POSITIVE_DECIMAL.test(item.quantity) && Number(item.quantity) > 0;
    if (!validQuantity) issues.push({ code: "invalid_quantity", field: `items.${index}.quantity`, message: "Quantity must be greater than zero with at most three decimal places." });
    const validPrice = Number.isSafeInteger(item.unitPricePaise) && item.unitPricePaise > 0;
    if (!validPrice) issues.push({ code: "invalid_unit_price", field: `items.${index}.unitPricePaise`, message: "Unit price must be a positive integer number of paise." });
    if (validQuantity && validPrice) {
      const milliPaise = decimalToMilli(item.quantity) * BigInt(item.unitPricePaise);
      if (milliPaise % 1000n !== 0n) {
        issues.push({ code: "invalid_amount", field: `items.${index}`, message: "Each item line must resolve to a whole number of paise." });
      } else {
        totalPaise += milliPaise / 1000n;
      }
    }
  });
  if (issues.length === 0 && totalPaise !== BigInt(command.amountPaise)) {
    issues.push({ code: "amount_mismatch", field: "amountPaise", message: "The confirmed amount must equal the sum of all confirmed item lines." });
  }
  return issues;
}
