# Testing

## Verification levels

`scripts/check-source.py` runs without npm downloads. It validates JSON, resolves local import paths, asks Node 24 to parse backend TypeScript, checks private env exclusion, and executes 20 money-boundary assertions from the exact source. It is **not a TypeScript typecheck, JSX build, SQL execution or security audit**.

Full checks after `npm install --include=dev`:

```bash
npm run lint
npm run build
npm test
npm run test:integration
npm run test:e2e --workspace frontend
npm audit --omit=dev --audit-level=high
```

## Database isolation

Set TEST_DATABASE_URL to a local database named `nextaka_test` or `nextaka_test_suffix`. Only localhost/127.0.0.1 are accepted. Integration setup rejects missing/nonlocal/production-like URLs before importing the application and applies committed migrations. Use a freshly recreated disposable test database per run. Fixtures intentionally remain available for inspection; they must never be seeded in production.

Unit tests cover money parsing/precision, Argon2id verification, randomness and fail-closed readiness. Integration suites cover registration/login/verification/reset, CSRF, admin/tenant boundaries, persistent rate limits, suspicious shared registrations, deposit evidence/dual review, concurrent purchase/withdrawals, insufficient balances, request replay, actual revenue allocation, settlement duplication, referral funding, promotional separation and immutable ledger/refund constraints.

Frontend tests cover paisa formatting/parsing, risk copy and report redaction. Playwright covers 320px, Android viewport and desktop public navigation. The anonymous protected-route test requires E2E_API_READY with a real running test API; a skipped test is not a pass. Live CAPTCHA/email/mobile-device/provider testing must be done separately. No production mock API is shipped.

GitHub Actions provides PostgreSQL 17 and runs build/tests/audit. It has not been executed for this handoff. If it fails, inspect and fix the relevant issue before calling the release verified.

There is no claim that every possible concurrency or security scenario is covered. Review data leakage, cookie configuration, local legal policies, reserve custody, recovery and rate-limit load behavior before live use.
