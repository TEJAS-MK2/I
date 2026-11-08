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
- `record_credit_sale` performs the sale header, item rows, ledger entry and stock decrements in one Postgres transaction.
- Idempotency claims prevent duplicate commits on retries.
- Client-facing tables have RLS and read-only grants. Direct client writes are intentionally unavailable.
- The privileged write implementation lives in the unexposed `private` schema, is SECURITY DEFINER with an empty search path, explicitly checks `auth.uid()` and active business membership, and is called through a public SECURITY INVOKER wrapper granted only to authenticated users.

## Edge Function

`functions/record-credit-sale/index.ts` verifies the bearer session with `auth.getUser`, validates request shape, and forwards the caller JWT to the database RPC. It never uses a service-role/secret key. Keep JWT verification enabled when deploying the function.

Required environment:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`)
- `APP_ORIGIN` (exact allowed web origin; set this before deployment)

## API contract

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

- Business/customer/product onboarding and invitations are not implemented.
- Reversal RPC and UI are still required; the schema supports reversal records but does not expose a reversal command yet.
- No dedicated Boli-Khata Supabase project is provisioned or configured.
- No secrets, authentication provider settings, email/SMS delivery, backups, monitoring, rate limits, or production deployment have been configured.
- The SQL must be reviewed and tested with pgTAP against a dedicated development project before it is applied to production.

## Security release gates

1. Apply schema to a dedicated development project only.
2. Test tenant isolation, role permissions, insufficient stock, exact paise arithmetic, concurrent idempotency, append-only behavior and rollback with pgTAP.
3. Run Supabase security/performance advisors and remediate all high-severity findings.
4. Add authenticated onboarding and membership lifecycle.
5. Implement full reversal and correction flows.
6. Only then connect the frontend confirmation UI to the RPC.
