# Extended Business Modules

This is the additive database layer for the next Boli-Khata workflows. Apply
`supabase/extended_modules.sql` only after `supabase/schema.sql` on a dedicated
Boli-Khata Supabase project.

## Included data capabilities

- **Voice review:** session metadata, language tag, bounded transcript storage,
  typed intent proposals, confidence, ambiguity flags and review lifecycle.
- **Local logistics:** delivery jobs, active assignments, append-only delivery
  events, collection amounts and private object keys for proof-of-delivery files.
- **Customer communications:** per-channel consent state, notification outbox,
  idempotency and append-only provider delivery attempts.
- **Audit:** append-only business-scoped events with actor, entity, request ID
  and structured metadata.
- **Reporting:** a security-invoker daily summary grouped by India Standard Time
  business date, with integer-paise totals.

## Security boundaries

- The migration does not grant anonymous access.
- New tables have row-level security enabled and business-membership read policies.
- There are no direct browser write grants or write policies. Mutations must go
  through narrowly scoped server-side functions that validate membership,
  role, consent, payload, idempotency and current business state.
- Composite foreign keys keep child records within the same business.
- Delivery events, notification attempts and audit events are append-only.
- Proof-of-delivery stores an object key, never a public URL. Store files in a
  private bucket and issue short-lived signed URLs only after authorization.
- Transcript text is bounded and has an explicit expiry field. A scheduled
  retention job and deletion policy are still required before production.
- Communication preferences default to `unknown`; outbound messaging must be
  suppressed unless the customer has explicitly opted in for that channel.

## Deferred work

Authentication is not being expanded in this milestone. The existing secure
membership/RLS foundation is preserved rather than replaced with anonymous
database access. Provider credentials, scheduled workers, messaging delivery,
proof-of-delivery upload handlers, logistics mutation functions, and automated
transcript-retention jobs are not configured by this schema alone.

## Required verification before enabling these workflows

1. Apply the base schema and this additive SQL file to a disposable Postgres 17
   database.
2. Run SQL linting and integration tests for cross-business foreign-key rejection,
   RLS isolation, append-only triggers, notification consent enforcement and
   India-time daily aggregation.
3. Add server-side functions for each mutation; do not expose service-role keys.
4. Test delivery state transitions and prevent terminal-state rewrites.
5. Test notification idempotency, opt-out suppression, retry limits and provider
   webhook signature validation.
6. Test transcript expiry and private object access.
7. Deploy only after the dedicated hosted project and secret configuration exist.

The migration is source code only until those steps are completed; it does not
create tables in a hosted environment by being committed to GitHub.
