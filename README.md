# NEXTAKA

বাংলাদেশের জন্য React/Express/PostgreSQL-ভিত্তিক mining operations ও verified rewards accounting application। Currency BDT; অর্থ integer paisa-তে রাখা হয়। Default ভাষা বাংলা, English switch আছে।

**এই ZIP একটি বাস্তব source-code handoff; verified production release নয়।** Package download অনুমতি সম্পন্ন না হওয়ায় npm build, full tests ও deployment এখানে চালানো হয়নি। কী পরীক্ষা হয়েছে এবং কী বাকি আছে: [Release status](docs/RELEASE_STATUS.md)।

## Android থেকে শুরু

1. ZIP extract করুন। `nextaka` folder-এর **ভেতরের** files/folders GitHub `nextaka` repository-র root-এ upload করুন। ZIP শুধু upload করলে GitHub সেটি unzip করে না। আগের হাতে বানানো তিনটি ফাইলের বদলে এই ZIP-এর একই নামের ফাইল ব্যবহার করুন।
2. [Upload guide](docs/UPLOAD_BN.md) অনুসরণ করুন। GitHub Actions-এর checks দেখুন। ব্যর্থ check ঠিক না করে deploy/launch করবেন না।
3. [Render deployment](docs/DEPLOY_BN.md) ও [Provider setup](docs/PROVIDER_SETUP_BN.md) অনুসরণ করুন। Secret শুধু provider dashboard/Render environment-এ দিন।
4. Free infrastructure শুধু pre-launch testing। Financial flags সব false রাখুন।

## Project

- `frontend`: React 19, Vite, TypeScript, Tailwind 4, Motion, Lucide, Recharts, TanStack Query, RHF/Zod। Landing, auth, dashboard, machines, wallet, referrals, receipts, profile, support এবং protected admin console।
- `backend`: Express 5, Prisma 6, PostgreSQL, Argon2id, opaque hashed sessions, signed CSRF, Turnstile verification, database-backed rate limiting।
- `backend/prisma`: full schema, initial migration, immutable ledger guards, runtime-role SQL, five disabled package targets। Seed কোনো user, balance, payment বা revenue তৈরি করে না।
- `backend/src/services`: purchases, deposits, withdrawals, actual revenue, funded allocations, settlement, referrals এবং promotional credits।
- `render.yaml`: free pre-launch blueprint; `render.production.yaml`: optional paid blueprint, সব financial gates এখনও বন্ধ।

## Commands (repository root, Node 24)

```bash
npm install --include=dev
npm run build
npm run lint
npm test
npm run check:source
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
npm run dev:backend
```

অন্য terminal-এ `npm run dev:frontend`। প্রথম installation-এর generated `package-lock.json` review করে commit করুন। তারপর reproducible build-এর জন্য `npm ci` ব্যবহার করুন। এই archive-এ বানানো/অসম্পূর্ণ lockfile নেই।

`TEST_DATABASE_URL`-এ **local isolated nextaka_test database** দিয়ে `npm run test:integration` চালান। Production DB দিয়ে test চালাবেন না। Browser tests: `npm run test:e2e --workspace frontend`।

## Financial truth

Package targets guaranteed profit নয়। Total target-এর মধ্যে purchase amount ইতিমধ্যেই আছে। Principal দ্বিতীয়বার দেওয়া হয় না। User deposits কোনো mining/referral reserve source নয়। Money is credited only through approved evidence workflows; manual evidence still requires genuine provider/bank verification by people.

Separate wallets: MAIN cash, WITHDRAWAL cash, PROMOTIONAL non-withdrawable credit, RESERVED withdrawal holds। Every balance comes from immutable ledger entries। No arbitrary admin balance edit endpoint exists।

## Missing external configuration

Render project/database, email sender, CAPTCHA keys, merchant accounts, actual mining source, funding evidence এবং legal/security approvals এই archive-এ নেই। Phone OTP, MFA এবং official bKash/Nagad APIs **Not configured**। Manual payment review is implemented; third-party approval is not simulated।

১২৮টি archive file-এর তালিকা: [Project manifest](docs/PROJECT_MANIFEST.md)। Stack অপরিবর্তিত; ZIP-এ maintainability-এর জন্য আগের conversational file list পুনর্বিন্যাস করা হয়েছে। Archive-এর পুরো project একসঙ্গে ব্যবহার করুন।
