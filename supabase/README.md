# Boli-Khata backend foundation

## Current state

The backend source in this directory is a reviewed implementation candidate. It has **not** been applied to a hosted Supabase project or deployed. The connected Supabase account currently exposes other projects, but none is identified as a dedicated Boli-Khata environment. Do not run this schema against an unrelated project.

## Architecture

- Supabase Auth provides identity; the JWT subject is the actor identity.
- PostgreSQL is the source of truth.
- Business membership and role are checked on the server using `auth.uid()`; client-supplied roles and editable user metadata are never authorization inputs.
- Money is stored as integer paise and currency is explicitly INR.
- `business_transactions`, `transaction_items`, `ledger_entries` and `inventory_movements` are append-only.
- Current product stock is a projection updated only inside the atomic transaction function; movement rows preserve the stock audit trail.
- `create_business`, `create_customer` and `create_product` provide authenticated onboarding/master-data setup. Opening stock is captured as an append-only inventory movement.
- `record_credit_sale` performs the sale header, item rows, ledger entry and stock decrements in one Postgres transaction.
- `reverse_credit_sale` appends a linked sale reversal, negative ledger entry and compensating stock movements; it refuses to reverse a sale whose value has already been settled.
- `record_customer_payment` appends a negative payment ledger entry, enforces the outstanding balance ceiling and records the payment method.
- `reverse_customer_payment` appends a positive compensating entry; it does not claim to refund or reverse an external bank/UPI transfer.
- Idempotency keys are bound to a canonical request payload; reusing a key with a different payload is rejected.
- Idempotency claims prevent duplicate commits on retries.
- Client-facing tables have RLS and read-only grants. Direct client writes are intentionally unavailable.
- The privileged write implementation lives in the unexposed `private` schema, is SECURITY DEFINER with an empty search path, explicitly checks `auth.uid()` and active business membership, and is called through a public SECURITY INVOKER wrapper granted only to authenticated users.

## Edge Functions

`functions/business-setup/index.ts` handles business onboarding plus customer and product creation through database RPCs.
`functions/record-credit-sale/index.ts` verifies the bearer session with `auth.getUser`, validates request shape, and forwards the caller JWT to the database RPC.

`functions/reverse-credit-sale/index.ts` exposes the owner/admin-only sale reversal RPC.
`functions/record-customer-payment/index.ts` records confirmed customer receipts.
`functions/reverse-customer-payment/index.ts` exposes owner/admin-only payment ledger reversal.

All three handlers use the caller JWT and publishable key; none uses a service-role/secret key. Keep JWT verification enabled when deploying them.

Required environment:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`)
- `APP_ORIGIN` (exact allowed web origin; set this before deployment)

## API contracts

POST `/functions/v1/business-setup`

- `{"action":"create_business","name":"My Store"}`
- `{"action":"create_customer","business_id":"UUID","display_name":"Ramesh","phone_e164":"+919876543210"}`
- `{"action":"create_product","business_id":"UUID","name":"Sugar","unit_label":"kg","unit_price_paise":15000,"opening_stock":5}`

POST `/functions/v1/record-customer-payment`

- `{"business_id":"UUID","customer_id":"UUID","amount_paise":50000,"currency":"INR","idempotency_key":"...","payment_method":"cash","confirmed":true}`

POST `/functions/v1/reverse-customer-payment`

- `{"business_id":"UUID","original_transaction_id":"UUID","idempotency_key":"...","confirmed":true}`

POST `/functions/v1/record-credit-sale`

```json
{
  "business_id": "UUID",
  "customer_id": "UUID",
  "amount_paise": 30000,
  "currency": "INR",
  "idempotency_key": "voice-proposal-unique-0001",
  "confirmed": true,
  "items": [
    {
      "product_id": "UUID",
      "quantity": 2,
      "unit_price_paise": 15000
    }
  ]
}
```

The caller must review the transcript, customer, currency, quantities and total, then explicitly confirm. AI or speech output cannot set the confirmation state. The server recalculates line totals, checks inventory and membership, and commits all records atomically. A retry must reuse the same idempotency key.

## Not production-ready yet

- Business onboarding and customer/product creation RPCs are implemented and covered by isolated PostgreSQL CI; invitation and staff-membership lifecycle are still missing.
- Reversal RPC and Edge Function source are implemented; the reversal UI and customer-facing balance history are still required.
- No dedicated Boli-Khata Supabase project is provisioned or configured.
- No secrets, authentication provider settings, email/SMS delivery, backups, monitoring, rate limits, or production deployment have been configured.
- The SQL is currently executed against a disposable PostgreSQL 17 CI service with tenant-isolation, atomic stock/ledger, idempotency, reversal and append-only checks. A dedicated Supabase development project and Supabase-specific advisor review are still required before production deployment.

## Security release gates

1. Apply schema to a dedicated development project only.
2. Test tenant isolation, role permissions, insufficient stock, exact paise arithmetic, concurrent idempotency, append-only behavior and rollback with pgTAP.
3. Run Supabase security/performance advisors and remediate all high-severity findings.
4. Add staff invitations, role management and business switching.
5. Build customer, catalogue, khata and reversal UI workflows.
6. Connect the frontend confirmation UI to the RPC only after the dedicated development environment passes its security review.
