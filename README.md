# Boli-Khata

**A voice-and-touch business assistant for India's small businesses.**

Boli-Khata helps shopkeepers, street vendors and independent courier operators manage everyday business through natural-language voice commands and a clear, accessible web interface.

> India-wide market · Web application · Hybrid voice + touch · Cloud-first architecture

## Product vision

Make everyday business operations easier for people who are busy serving customers—not sitting behind a computer. Boli-Khata brings customer khata, inventory, billing, communication and local logistics into one practical workspace.

## Current status

- [x] Product direction and initial technical blueprint
- [x] Phase 1 foundation branch and project scaffold
- [ ] Phase 1 review and acceptance
- [x] Phase 2 voice-provider boundary and review-only proposal prototype
- [x] Server-side transaction contract, atomic credit-sale and reversal procedures (schema source + CI-tested)
- [x] Supabase browser client and email/password authentication UI (environment-gated)
- [x] First-business onboarding UI and authenticated setup API
- [x] Customer directory live query/create integration source
- [x] Khata ledger live read integration source
- [x] Inventory catalogue and product/opening-stock integration source
- [ ] Dedicated Supabase project, Auth configuration and hosted Edge Function deployment
- [ ] Production speech provider and frontend confirmation integration
- [x] Customer, khata, inventory and billing workspace screens; customer/ledger/inventory source is wired for a configured backend
- [x] Installable PWA shell with static-only offline fallback
- [x] Reviewed credit-sale billing and explicit confirmation UI (requires hosted project)
- [x] Customer payment recording and owner/admin payment ledger reversal workflow
- [x] Idempotent onboarding, customer creation and product/opening-stock creation
- [ ] External payment gateway reconciliation and receipt delivery
- [ ] Phase 5 transaction intelligence
- [ ] Phase 6 customer communication
- [ ] Phase 7 local logistics
- [x] Additive voice-session, intent-review, delivery, consent, notification-outbox and audit schema source (not deployed)\n- [x] India-time daily business summary view source (security-invoker; not deployed)\n- [ ] Phase 8 production hardening

The repository contains environment-gated Supabase Auth (authentication work is deferred for this milestone), first-business onboarding, customer and product create flows, live customer/ledger/inventory query integration source, and an installable PWA shell. Without a dedicated project and environment variables, the app deliberately remains in clearly labelled sample preview mode. Its service worker caches only same-origin static app assets and never caches auth, database, function, storage or other API responses. Offline mode is shell-only; it does not queue or commit financial changes. The repository also contains CI-tested Postgres procedures and authenticated Edge Function source for idempotent business/customer/product setup, credit sales, sale reversals, customer payments and payment ledger reversals. These are not yet applied or deployed to a dedicated hosted Boli-Khata project. No production speech provider, payment integration or WhatsApp integration is configured yet.

## Technology direction

- Frontend: React, TypeScript, Vite
- Backend: Supabase Edge Functions (Deno + TypeScript)
- API: authenticated REST/RPC; realtime only where justified
- Data: Supabase PostgreSQL with row-level security
- Validation: deterministic TypeScript domain rules + database constraints
- Testing: Vitest, React Testing Library, Deno typecheck and isolated PostgreSQL integration tests
- Delivery: PWA, GitHub Actions and Vercel frontend; dedicated Supabase project for Auth/Postgres/Functions

Speech recognition will use a provider adapter so language coverage, latency, privacy and cost can be compared before a provider is selected.

## Architecture and planning

- [Development blueprint](docs/BLUEPRINT.md)
- [PWA and offline behavior](docs/PWA.md)
- [System architecture](docs/ARCHITECTURE.md)\n- [Extended business modules](docs/EXTENDED_MODULES.md)
- [Security model](docs/SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## Core safety principle

AI may interpret a spoken request and propose a structured action. It must never directly write financial or inventory records. A deterministic transaction service validates the proposal, checks business permissions and commits approved changes atomically. Financial history is corrected through reversals, not destructive edits.

## Development

Requirements: Node.js 20.19+ or 22.12+, and npm.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Project status

The feature branch now includes the voice proposal preview, exact-paise domain validation, tenant-scoped Postgres schema, atomic credit-sale and reversal RPCs, authenticated Edge Function handlers, and backend CI checks. Hosted deployment remains gated on a dedicated Boli-Khata Supabase project and security review.

## License

See [LICENSE](LICENSE).
