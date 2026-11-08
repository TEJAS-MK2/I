# Contributing

Thanks for helping build Boli-Khata.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Workflow

1. Discuss substantial changes in an issue first.
2. Work on a focused branch.
3. Keep changes small and explain user impact.
4. Add tests for behavior changes.
5. Run typecheck, tests and production build.
6. Update documentation when architecture or workflows change.
7. Open a pull request with summary, test evidence and UI screenshots where relevant.

## Engineering rules

- TypeScript strict mode; avoid any unless justified.
- Validate untrusted data at boundaries.
- Keep domain logic out of React components.
- Never let AI output directly execute a business mutation.
- Use decimal-safe money handling in backend code.
- Preserve audit history and reverse financial corrections.
- Do not commit secrets, real customer data or private recordings.
- Maintain keyboard access, visible focus and responsive layouts.

## Pull request checklist

- [ ] Scope and user impact are described.
- [ ] Tests cover important behavior.
- [ ] Typecheck passes.
- [ ] Production build passes.
- [ ] Accessibility and mobile behavior considered.
- [ ] Documentation updated.
- [ ] No secrets or real personal data included.
