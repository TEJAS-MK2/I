# Boli-Khata production infrastructure runbook

## Deployment boundary

This repository is not yet connected to a dedicated Boli-Khata Supabase project or Vercel production project. Do not reuse another product's database. The intended Supabase region is Mumbai (`ap-south-1`) for the India-first product. The current source targets PostgreSQL 17.

Authentication changes are explicitly deferred for this milestone. Keep every Edge Function JWT verification setting enabled and retain the existing RLS and server-side membership checks. This means authenticated operational flows cannot be accepted as production-ready until the owner later approves and configures the authentication experience.

## Required environments

### Supabase project

Create a dedicated project named `boli-khata-production` in the owner's selected organization and Mumbai region. Confirm the quoted recurring cost before provisioning. Keep the existing unrelated projects untouched.

The platform provides these Edge Function variables automatically:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEYS` (JSON dictionary; use the `default` key)
- Legacy `SUPABASE_ANON_KEY` for compatibility

All nine functions use `supabase/functions/_shared/keys.ts` to prefer the current publishable-key dictionary and fall back to legacy key variables. They forward the end-user JWT in the Authorization header; never substitute a secret/service-role key.

Set this custom Edge Function secret after the production web origin is known:

- `APP_ORIGIN`: exact HTTPS origin of the deployed web app, with no path or trailing slash (for example, `https://app.example.in`).

No service-role or secret API key is required by the current user-scoped functions. Do not add one to the browser or GitHub repository.

### Vercel project

Create/link the Git project only after the reviewed application branch is approved for the production branch. Configure:

- Framework preset: Vite
- Root directory: repository root
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm ci`
- Production environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Preview environment: separate non-production Supabase URL/key; do not point preview deployments at production customer data.

Only a publishable key belongs in `VITE_*` variables. Never use a secret/service-role key in Vercel browser environment variables.

## Initial database rollout

The current SQL is in two reviewed source files:

1. `supabase/schema.sql` — core business, membership, customer, product, transaction, ledger, RLS and transaction RPC foundation.
2. `supabase/extended_modules.sql` — voice proposals, delivery operations, customer consent, notification queue, audit, daily reporting and owner/admin stock adjustments.

Apply the core schema first, then the extended modules, to the dedicated empty project only. Use tracked migrations and capture the generated migration versions in Git before routine subsequent deploys. Do not apply these files to the existing ATLAS or generic Supabase projects.

After applying:

1. List tables and migration history.
2. Generate TypeScript database types and compare them with the application data access.
3. Run Supabase security and performance advisors; remediate every high-risk finding.
4. Verify RLS is enabled on every exposed business table and views use `security_invoker`.
5. Verify every public RPC has explicit grants/revokes and every privileged function checks the actor and business membership.
6. Run tenant-isolation and financial invariants using synthetic data only.

## Edge Function rollout

Deploy the following nine functions with JWT verification enabled:

- `business-setup`
- `record-credit-sale`
- `reverse-credit-sale`
- `record-customer-payment`
- `reverse-customer-payment`
- `delivery-operations`
- `customer-communication`
- `voice-proposals`
- `inventory-operations`

Deploy shared dependency `supabase/functions/_shared/keys.ts` with every function that imports it, and include `supabase/functions/deno.json`. Set `APP_ORIGIN` before browser smoke tests. Never use `--no-verify-jwt`.

## Web rollout and smoke tests

1. Set Vercel production environment variables to the dedicated project URL and publishable key.
2. Deploy the approved production branch.
3. Verify the PWA manifest, install prompt, static-only offline shell and HTTPS origin.
4. Verify unauthenticated requests are rejected by all nine function endpoints.
5. After authentication is explicitly enabled, verify an owner can create a business, customer and product; record and reverse a sale/payment; adjust stock; create and advance a delivery; record channel consent; and queue—but not send—a notification.
6. Verify a second business cannot read or mutate the first business's records.
7. Verify daily summaries use Asia/Kolkata dates and reconcile against ledger rows.
8. Confirm logs do not contain bearer tokens, publishable keys, private audio or unnecessary customer data.

Do not use real customer records for initial acceptance. Use disposable synthetic accounts and transactions.

## Rollback and operations

- Keep database changes additive. Do not drop financial tables or rewrite append-only history during rollback.
- If an Edge Function release fails, redeploy the last known-good function source and verify JWT checks remain enabled.
- If the web deployment fails, promote the last known-good Vercel deployment.
- Before production data is accepted, configure backups/point-in-time recovery appropriate to the chosen Supabase plan and run a restore drill.
- Configure alerting for repeated function 5xx responses, database saturation, failed deployments and anomalous transaction reversals.
- Keep a documented incident contact and a customer-data deletion/retention process.

## CLI compatibility note

The Supabase changelog dated 2026-11-04 announces CLI v3 changes: local-first defaults, confirmation for hosted changes and removed deprecated commands. Do not silently upgrade an existing deploy workflow to CLI v3. Pin and validate a CLI major version before introducing automated hosted deployment. The current repository CI uses Deno typechecking and an isolated PostgreSQL 17 service; it does not deploy to a hosted project.
