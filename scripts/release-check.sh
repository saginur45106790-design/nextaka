#!/usr/bin/env bash
set -euo pipefail
node --version
npm install --include=dev
npm run check:source
npm run lint
npm run build
npm test
: "${TEST_DATABASE_URL:?Set a local isolated test database connection}"
npm run test:integration
npm audit --omit=dev --audit-level=high
printf '%s\n' 'Automated checks completed. Browser, provider and operational launch checks are still required.'
