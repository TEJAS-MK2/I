# System Architecture

## Style

Begin with a modular monolith: one API deployment with clearly separated domain modules. This avoids premature microservices while keeping boundaries explicit.

## Current frontend layout

```text
.
├── .github/workflows/ci.yml
├── docs/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── styles/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

Introduce backend and shared-contract workspaces when backend implementation starts; do not add empty abstractions prematurely.

## Domain modules

Identity, Businesses, Customers, Ledger, Catalogue, Inventory, Sales, Voice, Transaction, Audit, Notifications, Logistics and Reporting.

## Dependency direction

UI features call typed application services. Application services depend on domain interfaces. Infrastructure adapters implement database, speech, storage and messaging interfaces. Domain rules do not depend on AI or speech vendors.

## Transaction boundary

A sale that changes invoice, payment and stock commits in one database transaction. A repayment creates a ledger event and updates any materialized balance atomically. Database constraints remain the final guardrail.

## Tenant isolation

Resolve active business from authenticated membership server-side. Never treat a client-supplied business_id as authorization. Scope every query and mutation to an authorized business and test cross-tenant denial.

## External integrations

Wrap speech recognition, messaging and object storage behind interfaces. Keep credentials server-side. Use timeouts, backoff, health checks and explicit degraded states.

## Client data

Server state is authoritative. IndexedDB is for drafts and constrained offline queueing, not an independent financial ledger. Revalidate pending writes before submission.
