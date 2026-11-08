# Extended Business Modules

This is the additive database layer for the next Boli-Khata workflows. Apply
`supabase/extended_modules.sql` only after `supabase/schema.sql` on a dedicated
Boli-Khata Supabase project.

## Included data capabilities

- **Voice review:** session metadata, language tag, bounded transcript storage,
  typed intent proposals, confidence, ambiguity flags and review lifecycle.
- **Local logistics:** idempotent delivery creation, owner/admin assignment,
  guarded status transitions, append-only events and cash-collection limits.
- **Customer communications:** explicit per-channel opt-in/opt-out recording,
  consent-gated idempotent notification queuing and append-only provider attempts.
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
database access. Provider credentials, scheduled outbox workers, messaging delivery,
proof-of-delivery upload handlers and automated transcript-retention jobs are
not configured by this schema alone. The included delivery and consent/notification queue RPCs are exposed through
JWT-verified Edge Function endpoints. They are not yet connected to the frontend.

## API endpoints

- `POST /functions/v1/delivery-operations`: create, assign and record delivery events.
- `POST /functions/v1/customer-communication`: record channel consent and queue a notification.

The queue endpoint does not send messages. A separately deployed worker and
provider integration must re-check current consent immediately before delivery.

## Required verification before enabling these workflows

1. Apply the base schema and this additive SQL file to a disposable Postgres 17
   database.
2. Run SQL linting and integration tests for cross-business foreign-key rejection,
   RLS isolation, append-only triggers, notification consent enforcement and
   India-time daily aggregation. The repository CI applies this migration and
   runs the extended SQL invariants.
3. Expose the database RPCs through narrowly scoped Edge Function endpoints;
   do not expose service-role keys.
4. Keep testing delivery state transitions, terminal-state rewrites, cash
   collection caps and assignment authorization.
5. Test notification idempotency, opt-out suppression, retry limits and provider
   webhook signature validation before enabling a provider.
6. Test transcript expiry and private object access.
7. Deploy only after the dedicated hosted project and secret configuration exist.

The migration is source code only until those steps are completed; it does not
create tables in a hosted environment by being committed to GitHub.
