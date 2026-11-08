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
- [ ] Dedicated Supabase project, Auth configuration and hosted Edge Function deployment
- [ ] Production speech provider and frontend confirmation integration
- [ ] Phase 3 customer onboarding and khata ledger UI
- [ ] Phase 4 inventory and billing
- [ ] Phase 5 transaction intelligence
- [ ] Phase 6 customer communication
- [ ] Phase 7 local logistics
- [ ] Phase 8 production hardening

The repository now contains a CI-tested Postgres backend schema and authenticated Edge Function source for credit sales and reversals. These are not yet applied or deployed to a dedicated hosted Boli-Khata project. No production speech provider, payment integration or WhatsApp integration is configured yet.

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
- [System architecture](docs/ARCHITECTURE.md)
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
