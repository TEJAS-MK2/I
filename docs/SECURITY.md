# Security Policy

## Reporting a vulnerability

Do not publish exploitable details in a public issue. Use GitHub's private vulnerability reporting feature if enabled, or request a private contact channel from the maintainer. Include affected component, impact and reproduction steps. Do not access or retain other people's data during testing.

## Security principles

- Enforce tenant isolation on every server-side read and write.
- Use least-privilege roles and deny by default.
- Keep secrets out of source control, client bundles and logs.
- Validate untrusted inputs at API boundaries.
- Use secure sessions, CSRF protections where applicable, rate limiting and abuse monitoring.
- Use parameterized database access and safe output encoding.
- Keep uploads private; validate size, type and content.
- Use idempotency keys for consequential mutations.
- Preserve financial audit history; correct through reversals.
- Minimize voice data and define retention before production.
- Obtain consent before customer messaging.
- Review dependencies and security advisories regularly.

## Data handling

Do not log passwords, tokens, payment credentials, full private audio or unnecessary personal data. Use synthetic development data. Production backups must be access-controlled and restoration-tested.

## Supported versions

Security support applies to the latest default-branch version until a release policy is established.
