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
- [ ] Phase 2 multilingual voice engine
- [ ] Phase 3 customer and khata ledger
- [ ] Phase 4 inventory and billing
- [ ] Phase 5 transaction intelligence
- [ ] Phase 6 customer communication
- [ ] Phase 7 local logistics
- [ ] Phase 8 production hardening

This repository is in early foundation development. No production backend, speech provider, payment integration or WhatsApp integration is configured yet.

## Technology direction

- Frontend: React, TypeScript, Vite
- Backend: Node.js, TypeScript, Fastify
- API: REST + WebSockets where useful
- Data: PostgreSQL, Drizzle ORM
- Validation: Zod
- Testing: Vitest, React Testing Library, Playwright
- Delivery: PWA, GitHub Actions, Vercel frontend and separately managed API/database

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

The Phase 1 branch establishes the product foundation and initial frontend shell. Features are delivered incrementally; badges and deployment links will be added only after their workflows and deployments are verified.

## License

See [LICENSE](LICENSE).
