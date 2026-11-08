# Boli-Khata — Technical Development Blueprint

## Product decisions

- Market: India-wide.
- Platform: Web application.
- Interaction: Hybrid voice and touch.
- Data architecture: Cloud-first.

## Product vision

A practical business assistant for kirana stores, street vendors, small retailers and independent delivery operators. Voice reduces typing; touch provides review, correction and accessibility.

## Personas

- Owner: manages shop, staff, catalogue, sales, credit and reports.
- Staff member: performs permitted sales and stock workflows.
- Vendor: records cash and credit transactions quickly.
- Delivery operator: views assigned jobs and records delivery outcomes.
- Administrator: manages business membership, permissions and settings.

## Product modules

1. **Voice workspace:** push-to-talk, transcription, language identification, mixed-language vocabulary, editable intent proposal, confidence/ambiguity metadata. Microphone permission and recording state are always visible.
2. **Customer and Khata:** customer profiles, aliases, credit entries, repayments, balances, statements, reversals and duplicate detection.
3. **Inventory:** product catalogue, units, aliases, pricing, stock movements, purchase records and low-stock alerts.
4. **Billing:** invoices, line items, payment methods, returns and receipts.
5. **Transaction intelligence:** deterministic validation, customer matching, permission checks, confirmation, idempotency, audit history and reversals.
6. **Customer communication:** templates, receipts, reminders, opt-in/opt-out and message delivery status. WhatsApp integration comes only after provider setup.
7. **Local logistics:** delivery jobs, assignments, parcel status, cash collection and proof of delivery.
8. **Business intelligence:** sales, payments, outstanding credit, stock and clearly labelled estimates.

## Recommended stack

| Layer | Technology |
|---|---|
| Web | React, TypeScript, Vite |
| UI | Tailwind CSS and accessible primitives |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod |
| API | Node.js, TypeScript, Fastify |
| Contracts | Zod schemas and OpenAPI |
| Database | PostgreSQL |
| ORM | Drizzle |
| Auth | Managed identity provider or secure backend sessions |
| Realtime | WebSockets / SSE where justified |
| Storage | Private S3-compatible object storage |
| Voice | Pluggable speech-to-text adapter |
| Tests | Vitest, Testing Library, Playwright |
| CI/CD | GitHub Actions; Vercel frontend and managed API/database |

Vendor selection for speech, auth, database and storage remains open until coverage, latency, privacy, retention, reliability and cost are compared.

## Architecture

React PWA → typed API → modular application services → domain rules → PostgreSQL. Speech and messaging providers sit behind adapters. Start as a modular monolith, not microservices.

Modules: Identity, Businesses, Customers, Ledger, Catalogue, Inventory, Sales, Voice, Transaction, Audit, Notifications, Logistics and Reporting.

## Domain model

- Identity: users, sessions, businesses, memberships, roles, invitations.
- Customers: customers, customer_aliases, communication_preferences.
- Catalogue: products, units, product_aliases, price_history.
- Ledger: ledger_entries, ledger_reversals, payments.
- Sales: invoices, invoice_items, sale_payments, returns.
- Inventory: stock_movements, stock_balances, suppliers, purchases.
- Voice: voice_sessions, transcripts, intent_proposals.
- Audit: audit_events, idempotency_records.
- Messaging: message_templates, notification_jobs, delivery_attempts.
- Logistics: delivery_jobs, delivery_assignments, delivery_events, proof_of_delivery.

Every tenant-owned record includes business_id. Resolve the active business from authenticated membership on the server; never trust a client-provided business_id.

## API direction

Version under /api/v1. Resource groups: /auth, /businesses, /memberships, /customers, /products, /inventory/movements, /sales, /payments, /returns, /voice/sessions, /voice/proposals, /deliveries, /notifications, /reports and /audit-events.

Mutations use idempotency keys. Return stable error codes, field-level validation details and request IDs. Never expose provider secrets or raw database errors.

## Voice proposal contract

A proposal includes schema_version, intent, entity references or unresolved names, amount and currency, quantity and unit, confidence, ambiguity flags, transcript reference, proposed operations and requires_confirmation. Business scope is derived from authenticated context, not speech.

Unresolved customer, currency, amount, unit or operation blocks commit and triggers clarification. Server revalidates every field at commit time.

## Transaction integrity

- Ledger entries are append-only; corrections use linked reversals/adjustments.
- Sales, payments and stock changes commit atomically.
- Store money using database NUMERIC/decimal-safe arithmetic, never floating point.
- Currency is explicit (ISO 4217); do not assume every business uses the same currency.
- Quantity precision follows unit configuration.
- Idempotency prevents duplicate voice submissions and network retries.
- Record actor, business, source, request ID and timestamps.
- Risk-based confirmation is required for ambiguous or high-impact actions.
- AI proposes; deterministic services validate and commit.

## Security and privacy

Tenant isolation at API and database layers; least-privilege roles; secure sessions; CSRF protections where applicable; rate limiting; TLS; managed encryption; secrets in deployment secret stores; strict validation; private storage and short-lived signed URLs. Avoid logging tokens, passwords, unnecessary transcripts or raw audio. Define audio retention and deletion before launch. Obtain consent and honor opt-out before outbound messaging. Assess applicable Indian privacy, consumer and messaging requirements with qualified review before production.

## Cloud-first resilience

Cloud PostgreSQL is the source of truth. IndexedDB may hold drafts and a constrained pending-operation queue. Never silently replay stale financial mutations. Revalidate on reconnection and ask for review when server state changed. Show sync state and conflicts clearly.

## Quality strategy

- Unit: money, balances, stock calculations, intent schemas, permission rules.
- Integration: constraints, atomic sale, tenant isolation, idempotency.
- UI: voice states, confirmation, forms, navigation and responsive layouts.
- E2E: sign-in, customer, product, sale, repayment and reversal.
- Accessibility: keyboard, screen reader labels, contrast and focus.
- Performance: low-end Android, slow networks, large catalogues.
- Security: authorization, rate limits, upload validation and dependency review.

## Eight-phase roadmap

| Phase | Scope | Acceptance criteria |
|---|---|---|
| 1. Foundation | Product docs, architecture, repo conventions, UI shell, design tokens, CI | Install, typecheck, build and CI pass; responsive accessible shell |
| 2. Voice | Microphone, provider adapter, transcript review, language metadata, intent proposal | Test corpus; visible permission states; speech never auto-writes |
| 3. Khata | Customers, identity resolution, credit, repayment, statements | Correct balances, reversal and tenant-isolation tests |
| 4. Inventory & billing | Catalogue, stock, sales, receipts | Atomic sale/stock change, unit validation, idempotent retries |
| 5. Transaction intelligence | Clarification, risk confirmation, duplicate prevention, audit | Ambiguous/invalid commands cannot commit; retry cannot double-post |
| 6. Communication | Templates, consent, WhatsApp provider | Consent and opt-out enforced; delivery retries observable |
| 7. Logistics | Assignment, tracking, collection, proof of delivery | Role-scoped access and complete event history |
| 8. Production | Monitoring, backups, recovery, security, accessibility, performance | Restore drill, security review and release checklist |

## MVP boundary

Prioritize Phases 1–5. Add WhatsApp automation and logistics after the shop workflow is reliable. Start with a focused pilot before broadening every workflow.

## Open decisions

Speech provider, exact language coverage, managed infrastructure vendors, default audio retention, pricing model, pilot cohort and success metrics. These do not block Phase 1.
