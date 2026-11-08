# PWA and offline behavior

## Current implementation

- Installable manifest and Boli-Khata app icon.
- Production-only service-worker registration.
- Network-first navigation with cached app-shell fallback.
- Same-origin static assets (styles, scripts, images and fonts) may be cached after a successful network response.
- A visible connectivity indicator distinguishes online mode from offline shell mode.

## Privacy and financial safety

The service worker never caches authentication, REST/Data API, Edge Function, storage, realtime or other API routes. It does not intercept non-GET requests. It does not cache customer records, ledger entries, invoices, payments, stock data or authentication tokens.

Offline mode is shell-only. The app does not queue or replay financial mutations while offline. Users must reconnect before authenticated business operations can be submitted.

## Future offline support

If offline drafts are introduced, keep them separate from the authoritative ledger:
- Store only explicitly reviewed drafts in IndexedDB.
- Never generate a financial commit while offline.
- On reconnect, re-fetch customer, catalogue, price and stock state.
- Require the user to review conflicts and explicitly confirm again.
- Use the same server idempotency key when retrying a confirmed request.
- Never silently replay a stale sale, payment or stock adjustment.

## Verification

The PWA assets are included in the Vite production build. The CI workflow verifies the frontend typecheck, tests and production build. Device installation, browser-specific service-worker behavior and real offline acceptance still require manual testing on supported Android browsers and low-end devices.
