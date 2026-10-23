# Android থেকে Render deployment

প্রথমে [ZIP upload নির্দেশনা](UPLOAD_BN.md) এবং [release verification status](RELEASE_STATUS.md) পড়ুন। এই environment-এ পূর্ণ build/tests চালানো হয়নি; GitHub Actions সবুজ না হওয়া পর্যন্ত deploy-ready দাবি করবেন না। ZIP-এর source repo root-এ রাখুন, nested nextaka folder নয়। প্রথম npm install থেকে lockfile তৈরি হবে; ZIP-এ lockfile নেই।

এই নির্দেশনার প্রথম deployment একটি **pre-launch installation**। এখানে account ও interface যাচাই করবেন; কোনো ব্যবহারকারীর টাকা নেবেন না। বাস্তব mining revenue বা merchant settlement ছাড়া configuration flag বদলানো আয় তৈরি করে না।

## ১. GitHub repository প্রস্তুত করুন

1. Android Chrome-এ GitHub-এ sign in করুন। প্রয়োজন হলে menu → **Desktop site** চালু করুন।
2. **New repository** চাপুন। নাম দিন `nextaka`। Private রাখলে source কেবল অনুমোদিত লোক দেখতে পাবেন।
3. Repository তৈরি হলে তার URL সংরক্ষণ করুন। এখানে তৈরি project ইতিমধ্যে Git-এ থাকলে আরেকটি README বা `.gitignore` তৈরি করবেন না; empty remote merge করা সহজ।
4. Codex-এর repository selector/connected GitHub settings থেকে এই repository নির্বাচন করুন এবং প্রয়োজনীয় access অনুমোদন করুন। Interface-এর নাম account/version ভেদে বদলাতে পারে।
5. Codex-কে বলুন: “বর্তমান NEXTAKA project আমার connected `nextaka` repository-তে push করুন; existing files সংরক্ষণ করুন।” GitHub credentials chat-এ লিখবেন না। Connection না থাকলে local files তৈরি হলেও GitHub-এ push হয় না।
6. GitHub-এর **Code** tab-এ `frontend`, `backend`, `render.yaml`, `package.json` এবং `docs` দেখা যাচ্ছে কি না নিশ্চিত করুন।

ফোন থেকে code লেখা প্রয়োজন নেই। Terminal command যেখানে আছে সেটি Codex workspace বা authorized Render Shell-এ চালানো যায়। Free web service-এ Shell/one-off jobs-এর সীমাবদ্ধতা থাকলে মাইগ্রেশন নিচের start command দিয়েই চলে।

## ২. প্রয়োজনীয় account ও খরচ

| জিনিস | কী লাগবে | সীমা/ব্যয় |
|---|---|---|
| GitHub | Repository access | নিজস্ব plan/quota যাচাই করুন |
| Render Static Site | GitHub connection | Included usage-এর মধ্যে free; subdomain availability-নির্ভর |
| Render Web Service Free | Node service | Idle ১৫ মিনিটে sleep; cold start হতে পারে |
| Render PostgreSQL Free | Database | ৩০ দিনে expire; managed backups নেই |
| Render paid database/service | Durable production environment | Paid; checkout-এ বর্তমান মূল্য দেখুন |
| Render Cron | Scheduled settlement job | Paid; প্রতি cron service-এ ন্যূনতম $1/মাস |
| Cloudflare Turnstile | Widget site key ও secret | বর্তমান Free plan-এ quota আছে; hosting Render-এই থাকে |
| Resend | API key, verified sender domain | Free mail quota আছে; sender DNS access লাগে |
| Merchant/mining services | অনুমোদন ও বাস্তব contract | পরিচয় যাচাই, business documents, fee বা paid contract লাগতে পারে |

Billing/payment method বা identity check accountভেদে provider চাইতে পারে। কোনো approval বা unlimited free service ধরে নেওয়া হয়নি। [Render limits](https://render.com/docs/free), [Render Cron](https://render.com/docs/cronjobs), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/), [Resend pricing](https://resend.com/pricing) — ২২ অক্টোবর ২০২৬-এ যাচাই করা। Resend-এর প্রকাশিত Free allowance তখন ৩,০০০ email/মাস, ১০০/দিন। quota বদলালে provider dashboard-ই authoritative।

## ৩. প্রথমে pre-launch Render deployment

সহজ পথ: Render Dashboard → **New → Blueprint** → GitHub-এর `nextaka` নির্বাচন → `render.yaml` review → create। Blueprint database, API ও static site প্রস্তুত করে। Secret-এর ঘর নিজে dashboard-এ পূরণ করুন; chat/GitHub-এ নয়। Actual assigned URL পাওয়ার পরে Environment values মিলিয়ে আবার deploy করতে হবে।

Blueprint review-এ **Free** database ও API নির্বাচিত আছে কি না দেখুন। `render.production.yaml` নির্বাচন করবেন না যতক্ষণ paid service তৈরি করতে প্রস্তুত না হন। একসঙ্গে দুটি blueprint ব্যবহার করে duplicate infrastructure তৈরি করবেন না।

ম্যানুয়াল পথ:

1. Render → **New → PostgreSQL**। নাম `nextaka-db`; একই region ব্যবহার করুন, Bangladesh থেকে সাধারণত Singapore মূল্যায়ন করা যায়। Free নির্বাচন করুন। Database name `nextaka`, user `nextaka_owner`।
2. Database ready হলে **Internal Database URL** কপি করুন। একই region-এর backend এই URL ব্যবহার করবে। এটি secret।
3. **New → Web Service** → `nextaka` repository নির্বাচন করুন। নাম `nextaka-api`; runtime Node; repository root খালি রাখুন। **Root Directory হিসেবে `backend` দেবেন না**—এই repository workspace lockfile ব্যবহার করে।
4. Build command: `npm install --include=dev && npm run build --workspace backend`
5. Start command: `npm run db:migrate --workspace backend && npm run db:seed --workspace backend && npm run start --workspace backend`
6. Health check path: `/api/health`। Region database-এর মতো। Pre-launch-এর জন্য Free plan।
7. নিচের Environment values দিন। `NODE_ENV=production` মানে secure HTTP behaviour; এর অর্থ financial launch নয়।
8. **New → Static Site** → একই repository। নাম `nextaka`; root খালি। Build: `npm install --include=dev && npm run build --workspace frontend`; publish directory: `frontend/dist`।
9. Frontend environment-এ actual API URL ও Turnstile public key দিন। **Redirects/Rewrites**-এ Source `/*`, Destination `/index.html`, Action **Rewrite** দিন। এতে `/dashboard` সরাসরি খুললেও React route কাজ করবে।
10. Static site-এর assigned URL কপি করে backend `FRONTEND_URL` এবং Turnstile hostname update করুন। API URL frontend-এ update করলে frontend **redeploy** প্রয়োজন।

Render service নাম বিশ্বব্যাপী free hostname নিশ্চিত করে না। Dashboard যেটি দেয় সেটিই ব্যবহার করুন; `https://nextaka.onrender.com` আগে থেকেই অন্যের হতে পারে।

## ৪. Environment values

Backend → Environment:

| নাম | কী বসাবেন |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render PostgreSQL Internal Database URL |
| `FRONTEND_URL` | actual frontend origin, যেমন dashboard-এ পাওয়া HTTPS URL; শেষে path নয় |
| `SESSION_SECRET` | আলাদাভাবে তৈরি অন্তত ৩২ অক্ষরের random secret |
| `IP_HASH_SECRET` | অন্য একটি অন্তত ৩২ অক্ষরের random secret |
| `TURNSTILE_SITE_KEY` | Turnstile-এর public site key |
| `TURNSTILE_SECRET_KEY` | Turnstile secret; backend-এ শুধু |
| `TURNSTILE_HOSTNAMES` | frontend hostname, scheme ছাড়া; একাধিক হলে comma-separated |
| `EMAIL_API_KEY` | Resend API key; backend-এ শুধু |
| `EMAIL_FROM` | verified sender, যেমন `NEXTAKA <security@your-owned-domain>` |
| `SUPPORT_EMAIL` | আপনার monitored support mailbox |
| `AUTH_TEST_BYPASS` | `false`; production-এ true করলে startup প্রত্যাখ্যাত হয় |
| `FINANCIAL_ACTIVITY_ENABLED` | `false` |
| `DURABLE_INFRASTRUCTURE_CONFIRMED` | `false` |
| `COMPLIANCE_APPROVED` | `false` |
| `PAYMENT_OPERATIONS_READY` | `false` |
| `TRUST_PROXY_HOPS` | Render-এর সামনে verified proxy topology অনুযায়ী; default `1` |

`openssl rand -hex 32` দিয়ে প্রতিটি secret আলাদাভাবে তৈরি করা যায়। Blueprint `generateValue` থাকলে Render নিজেই secret বানায়। Session secret rotate করলে চলতি CSRF/session behaviour পরীক্ষা ও logout পরিকল্পনা করুন।

Frontend-এর `VITE_API_URL`-তে actual API URL-এর শেষে `/api` দিন, যেমন dashboard-এ পাওয়া API origin + `/api`। `VITE_TURNSTILE_SITE_KEY`-তে public widget key দিন। `VITE_` দিয়ে শুরু সব value **public**। Database URL, private key, merchant password বা session secret এখানে কখনো দেবেন না।

## ৫. CAPTCHA ও email চালু করুন

1. Cloudflare Dashboard → Turnstile → **Add widget**। Managed mode নির্বাচন করুন। আপনার actual frontend hostname দিন। Cloudflare DNS/hosting-এ site সরানোর দরকার নেই।
2. Site key backend ও frontend public config-এ, secret key শুধু backend-এ দিন। Local testing-এর জন্য আলাদা widget/allowed `localhost` ব্যবহার করুন।
3. Resend account তৈরি করুন। **Domains → Add domain**-এ এমন domain দিন যার DNS আপনি নিয়ন্ত্রণ করেন। Provider-এর দেওয়া DNS verification records সেই DNS dashboard-এ বসান। Verified না হওয়া পর্যন্ত সাধারণ ব্যবহারকারীর email পাঠানো প্রস্তুত নয়।
4. **API Keys** থেকে sending key তৈরি করুন। Render backend Environment-এ `EMAIL_API_KEY` ও verified `EMAIL_FROM` দিন।
5. Free `onrender.com` hostname-এর DNS আপনার নিয়ন্ত্রণে নেই; সেটিকে নিজের verified sender domain ধরে নেওয়া যাবে না। Sender domain কিনতে খরচ লাগতে পারে। Provider-এর সীমিত test sender কেবল অনুমোদিত test recipient-এর জন্য ব্যবহার করুন।
6. Resend delivery log-এ নিজের verification email পৌঁছানো দেখুন। Backend logs-এ token/password print করা হবে না। Spam folder-ও দেখুন।

Render Free-এ সাধারণ SMTP outbound ports বন্ধ; এই backend HTTPS email API ব্যবহার করে। [Render Free documentation](https://render.com/docs/free) দেখুন। Registration-এর পরে email verification ছাড়া financial eligibility হয় না। Phone field সংগ্রহ করা আর phone verify করা আলাদা; SMS provider সংযুক্ত না হলে phone verification **Not configured** থাকবে।

## ৬. Database migration ও seed

Free deployment-এর start command migrations চালায়; deploy logs-এ সফল migration দেখুন। Seed শুধু পাঁচটি plan এবং safe configuration তৈরি করে; কোনো fake customer, revenue, wallet balance বা administrator তৈরি করে না।

Manual command, repository root থেকে:

```sh
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
```

Render Shell না থাকলে authorized Codex environment থেকে External Database URL দিয়ে একই command চালানো যায়। তখন network allowlist-এ কেবল প্রয়োজনীয় IP সাময়িকভাবে অনুমোদন করে পরে সরান। Credentials environment/secret settings দিয়ে দিন। Production-এ `prisma db push`, `migrate reset` বা migration file edit করে ইতিহাস বদলাবেন না।

Paid service-এ `preDeployCommand` migrations চালাতে পারে; production blueprint সেই পথ দেয়। Migration-এর আগে verified backup এবং staging run বাধ্যতামূলক operating practice।

## ৭. প্রথম administrator

1. Website থেকে নিজের email দিয়ে register করুন, CAPTCHA complete করুন এবং verification email-এর link ব্যবহার করুন।
2. Database-এ verified user তৈরি হওয়ার পর authorized Shell/Codex terminal-এ চালান:

```sh
npm run admin:create --workspace backend -- --email YOUR_VERIFIED_EMAIL
```

3. Command-এ নিজের verified email দিন। Password command/chat-এ দেবেন না। এই CLI existing verified user-এর role বদলায়; কোনো default admin password নেই।
4. Logout করে আবার login করুন এবং `/admin` খুলুন। সাধারণ user দিয়ে `/admin` ও admin API নিষিদ্ধ কি না পরীক্ষা করুন।
5. Admin access অল্পসংখ্যক ব্যক্তিকে দিন। Optional admin MFA পুরোপুরি configured/tested না থাকলে সেটিকে চালু বলা যাবে না। Render/GitHub/Resend account-এর নিজস্ব MFA সক্রিয় করুন।

আর্থিক review-এর জন্য দ্বিতীয়, আলাদা verified administrator প্রয়োজন। একই পদ্ধতিতে অনুমোদিত দ্বিতীয় ব্যক্তির account promote করুন। Operation/reserve/revenue/deposit evidence যিনি তৈরি করবেন, সেই একই ব্যক্তি নিজের evidence approve করতে পারবেন না।

## ৮. Android browser দিয়ে পরীক্ষা

Frontend-এর actual HTTPS URL খুলুন। Chrome normal এবং private browsing, ৩২০px-সমতুল্য ছোট screen, বাংলা/English switch এবং slow mobile network পরীক্ষা করুন। Free API প্রথম request-এ cold start হতে পারে; repeated submit না করে status/error দেখুন।

Register → email verify → login → dashboard → profile → support ticket → logout পরীক্ষা করুন। Dashboard নতুন account-এ database থেকে শূন্য balance দেখাতে পারে; API unreachable হলে error দেখানো উচিত। কোনো seeded positive balance থাকার কথা নয়।

দুইটি আলাদা `onrender.com` hostname-এর cookies browser third-party policy দ্বারা block হতে পারে। এই backend `HttpOnly`, `Secure`, `SameSite=None` cookies, exact origin allowlist ও CSRF ব্যবহার করে; browser blocking এড়িয়ে যেতে security কমানো হয়নি। Login loop হলে Browser DevTools/remote debugging দিয়ে Set-Cookie acceptance পরীক্ষা করুন। Production-এর জন্য নিজের domain-এর sibling hostnames, যেমন `app.your-domain` ও `api.your-domain`, configure করে compatibility যাচাই করুন। আরেকটি সমাধান হিসেবে verified same-origin proxy deployment আলাদাভাবে review করা যায়; static rewrite-কে পরীক্ষা ছাড়া cookie/API proxy হিসেবে ধরে নেওয়া হয়নি।

## ৯. Mining, payment ও scheduled settlement

এই source miner hardware চালায় না; এটি independently verified operation/revenue, funded allocations এবং wallet accounting পরিচালনা করে। Actual mining pool/provider-এর access, operation reference, legal contract, cost, revenue statement, verification evidence এবং payout reserve administrator-কে সরবরাহ করতে হবে।

প্রথমে [Financial operations](FINANCIAL_OPERATIONS.md) এবং [Launch checklist](LAUNCH_CHECKLIST.md) অনুসরণ করুন। bKash/Nagad merchant approval ও settlement access ছাড়া ব্যক্তিগত number বসিয়ে deposit চালু করবেন না। Screenshot/reference নিজে wallet cash তৈরি করে না। Official provider API adapter তখনই যোগ/সক্রিয় করুন যখন অনুমোদিত credentials ও যাচাইকৃত API specification আছে।

Settlement command:

```sh
npm run settle --workspace backend
```

Paid Render Cron-এর schedule `*/15 * * * *` রাখা হয়েছে; timezone UTC। এটি প্রতি ১৫ মিনিটে **যোগ্য verified allocation** পরীক্ষা করে। প্রতিটি contract-এর reward period ২৪ ঘণ্টা; cron প্রতি run-এ target balance তৈরি করে না। Failed run-এর পরে আবার চালানো যায়; unique settlement/idempotency constraints duplicate credit আটকায়।

Free web service-এর ভেতরে `setInterval`-কে reliable cron ধরা হয়নি। Paid cron তৈরি করার আগে billing দেখুন। Scheduled job API-এর একই database ও financial gate configuration ব্যবহার করবে; production blueprint-এ defaults এখনও false।

## ১০. বাস্তব অর্থের আগে

Paid durable PostgreSQL, tested restore, continuously available backend, monitoring, verified merchant records, documented legitimate mining revenue, adequate reserve, বাংলাদেশের প্রযোজ্য আইন/লাইসেন্স/কর/consumer protection review ও independent security review সম্পন্ন করুন। এই software কোনো license দেয় না।

এই প্রমাণগুলো এবং database approvals প্রস্তুত হওয়ার পর authorized operator flags পরিবর্তন করবেন। কেবল environment flags true করলেই সব record verified হয় না। Purchase ও payout failure এড়াতে financial controls বাদ দেবেন না।

## সাধারণ সমস্যা

| লক্ষণ | কী দেখবেন |
|---|---|
| Build failed | প্রথম TypeScript/dependency error; root build command ও lockfile |
| DB connect failed | Internal URL, একই region, database expiry, allowed access |
| `/dashboard` refresh-এ 404 | Static Site-এর SPA Rewrite rule |
| CORS/CSRF error | backend `FRONTEND_URL` actual origin-এর সঙ্গে হুবহু মেলে কি না |
| CAPTCHA ব্যর্থ | actual hostname, সঠিক site/secret pair, token expiry |
| Email আসে না | sender verification, quota, Resend logs, spam folder |
| Login বারবার হারায় | secure cookie acceptance, third-party browser policy, HTTPS |
| Deposit/purchase disabled | pre-launch gates; এটা default নিরাপদ অবস্থা |
| Settlement শূন্য | verified funded eligible allocation নেই; timer revenue বানায় না |

Secrets বা personal financial records screenshot-এ ঢেকে তারপর technical support-এ পাঠান।


## ZIP সংস্করণের অতিরিক্ত প্রয়োজনীয় ধাপ

- Root `package.json`-সহ workspace upload করতে হবে। Render build root repository root থাকবে। Node version 24।
- প্রথম build `npm install --include=dev`। Generated root package-lock.json commit করার পরে `npm ci --include=dev` ব্যবহার করুন।
- backend/.env.example স্থানীয় উন্নয়নের template। Render-এ প্রতিটি variable Environment tab-এ দিন; `.env` upload নয়। Blank `DATABASE_URL`, SESSION_SECRET ও IP_HASH_SECRET পূরণ না করলে server fail closed হবে। `node scripts/generate-secrets.mjs` private terminal-এ চালিয়ে দুই আলাদা secret নিন।
- `BACKUPS_RESTORE_TESTED=false` এবং `SECURITY_REVIEW_APPROVED=false`-সহ মোট ছয় financial env gate false রাখুন। Cron-এও একই readiness flags configure করতে হয়।
- `VITE_API_URL` হবে actual API URL + `/api`; যেমন আপনার assigned API hostname-এর `/api` path। `FRONTEND_URL` হবে actual frontend origin, শেষে `/` না দেওয়াই ভালো। VITE variable পরিবর্তনে frontend rebuild লাগবে।
- HTTPS cross-origin sessions Secure/SameSite=None/Partitioned cookies ব্যবহার করে। Android Chrome-এ login → refresh → logout পরীক্ষা করুন। Browser cookie block করলে setup সমাধান না করে launch করবেন না; same-site custom domains লাগতে পারে।
- Paid blueprint-এ `DATABASE_URL` নিজে runtime-role connection দিয়ে দিন। `MIGRATION_DATABASE_URL` owner connection; `db:migrate` script এটি আলাদা ব্যবহার করে। Owner দিয়ে runtime-role.sql চালানোর পর runtime credentials configure করুন।
- Free web service Shell না দিলে local/Codespaces-এ নির্দিষ্ট সময়ের external DB access allow করে owner CLI চালান; কাজ শেষে network access বন্ধ করুন। Password chat বা GitHub-এ দেবেন না।
- `npm run admin:create --workspace backend -- --email আপনার-যাচাইকৃত-email` ব্যবহার করুন। আগে app দিয়ে register/email verify করতে হবে। Financial review-এর জন্য দুইজন আলাদা admin প্রয়োজন।
- Paid Cron job প্রতি ১৫ মিনিটে `npm run settle:production --workspace backend` চালায়; এটি verified completed daily periods settle করে। Web service-এর JavaScript timer কোনো earning তৈরি করে না।
- Sitemap-এ নিজের actual URL দিতে private terminal-এ SITE_URL set করে `node scripts/generate-sitemap.mjs` চালান এবং generated file commit করুন। কোনো কাল্পনিক live domain seed করা হয়নি।

Provider quotas ও billing পুনরায় official dashboard-এ দেখুন। Resend sender domain-এর জন্য নিজের DNS access লাগতে পারে; free onrender hostname দিয়ে DNS verification করা যাবে ধরে নেবেন না।
