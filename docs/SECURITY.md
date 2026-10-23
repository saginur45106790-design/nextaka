# Security model ও operating requirements

এই নথি implemented controls যাচাই করার review guide; penetration-test certificate বা ১০০% নিরাপত্তার দাবি নয়। কোনো external security audit চালানো হয়েছে—এমন দাবি source code করে না।

## Trust boundaries

Browser public ও untrusted। Browser amount, role, account ID, target reward বা clock-কে authoritative মনে করা যাবে না। Express API identity/authorization যাচাই করে; Prisma trusted server থেকে PostgreSQL ব্যবহার করে। Database কখনো frontend-এ expose হবে না।

Supabase-style client-to-database access এই Render architecture-এ নেই। User isolation-এর প্রধান boundary API ownership checks। Private tables-এ public privileges প্রত্যাহার এবং database RLS defense-in-depth হলেও owner/superuser RLS bypass করতে পারে। একই trusted backend runtime role-এর RLS policy per-user isolation প্রমাণ নয়। Production-এ owner migration credential এবং restricted runtime credential পৃথক করতে হবে।

## Authentication

- Password hash server-এ; plaintext password database/log-এ নয়। Strong password validation উভয় পাশে, server authoritative।
- Random opaque session secret cookie-তে; database-এ token hash। Cookie `HttpOnly`; production-এ `Secure` ও cross-origin hosting-এর জন্য `SameSite=None`।
- Mutation request-এ allowlisted Origin ও CSRF token প্রয়োজন। CORS `*` দিয়ে credentials দেওয়া যাবে না।
- Email verification ও reset token single-use/expiry bounded। Login/register/reset-এর CAPTCHA server-এ verify হবে; wrong hostname/action reject করতে হবে।
- Password reset/change ও account suspension-এ sessions invalidation পরীক্ষা করুন। Account lock/recovery user enumeration ও denial-of-service risk বিবেচনায় review করুন।
- Production-এ `AUTH_TEST_BYPASS=true` অনুমোদিত নয়। Test database/provider fake শুধুমাত্র automated tests-এ; live frontend-এ নয়।

## Abuse controls

Persistent rate counters restart-এর পরে হারানো উচিত নয়। Rate rules per-IP hash/account/sensitive action অনুযায়ী bounded রাখুন। `TRUST_PROXY_HOPS` বাস্তব proxy topology অনুযায়ী দিন; অপরীক্ষিত X-Forwarded-For বিশ্বাস করলে attacker IP limit এড়িয়ে যেতে পারে।

IP ও device-derived signals pseudonymous risk data; legal/privacy disclosure এবং access control প্রযোজ্য। Disposable domain list exhaustive নয়। Verified email unique; verified phone unique হতে পারে, কিন্তু provider ছাড়া phone possession জানা যায় না। একই IP, device cookie বা unverified phone দিয়ে absolute one-person policy দাবি করবেন না।

## Financial controls

Money integer paisa; signed ledger delta, balance constraints ও database transaction দিয়ে accounting। Concurrent spending-এ row locks/serializable controls, request UUID idempotency এবং replay payload binding দরকার। Journal/settlement/reference uniqueness duplicate payment-credit প্রতিরোধ করে।

Revenue verification ও reserve funding wallet deposit থেকে পৃথক। Administrator cannot turn target amount into revenue using a timer. Evidence creator ও approver ভিন্ন। Financial admin routes-এ role check ছাড়াও action/state/evidence/funding validation লাগে।

## Production database role

`backend/prisma/runtime-role.sql` supplementary hardening procedure পড়ুন। Migration owner দিয়ে migration চালিয়ে limited runtime login-কে backend runtime group grants দিন। Password SQL source/chat-এ লিখবেন না; managed secret environment বা secure database administration tool ব্যবহার করুন।

Free pre-launch blueprint সহজ initial provisioning-এর জন্য Render-এর generated owner connection দেয়। **এই অবস্থাকে least-privilege production বলে দাবি করা যাবে না।** Financial launch-এর আগে migration path/runtime URL পৃথক করুন, restricted role দিয়ে integration tests চালান এবং deployment migration process পরীক্ষা করুন।

## HTTP, content ও upload

Backend Helmet, limited JSON body, structured validation ও safe error mapping ব্যবহার করে। Frontend React escaping বজায় রাখে; unsanitized HTML render করবেন না। Render static headers CSP/anti-framing/nosniff/referrer policy দেয়। Custom API domain যোগ করলে CSP-এর `connect-src` এবং backend exact origin allowlist update করুন।

কোনো unrestricted public file upload endpoint সক্ষম নয়। ভবিষ্যতে evidence upload যোগ করলে authentication, authorization, MIME/magic-byte check, size limit, malware scanning, private object storage, short-lived signed access এবং audit যুক্ত করুন। User-provided filename/path execute করবেন না।

## Secret ও logging policy

GitHub/Render account-এ MFA দিন। Database URL, email API key, Turnstile secret, session signing secret ও IP hash secret আলাদা রাখুন। `.env` commit করবেন না। `VITE_` variable public। Error response-এ SQL, stack trace, provider secret বা verification token নয়। Logs-এ password/session/authorization header/payment account masked থাকতে হবে।

Data export এবং audit log access administrators-এর প্রয়োজনীয় subset-এ সীমাবদ্ধ রাখুন। CSV export যুক্ত করলে spreadsheet formula injection neutralize করুন। Financial-history deletion endpoint expose করবেন না।

## Data protection ও retention plan

আইন, settlement disputes, accounting এবং consumer obligations অনুযায়ী operator-কে retention schedule অনুমোদন করতে হবে। নিচেরগুলো configuration/operating decisions; আইনগত সময়সীমা হিসেবে এগুলো দাবি করা হচ্ছে না।

| Data | Retention সিদ্ধান্ত | Disposal |
|---|---|---|
| Session/reset/verification token hashes | প্রয়োজনীয় validity ও short incident window | Expired data scheduled maintenance-এ remove |
| Risk/IP/device signals | fraud need ও privacy proportionality অনুযায়ী সীমিত | Anonymize/delete approved policy অনুযায়ী |
| Financial ledger/settlement/audit | আইনগত accounting/dispute retention | অনুমোদিত সময়ের আগে delete নয় |
| Support message ও identity/contact | support purpose/retention schedule | Verified deletion/anonymization review |
| Backups | recovery objectives ও legal retention | Encrypted expiry/deletion verification |

Account deletion request সরাসরি financial history মুছে দেয় না। Operator requester identity verify করে legal hold, outstanding money, dispute ও retention review করবে। Marketing/notification preferences financial service notice-এর দায়িত্ব থেকে আলাদা রাখুন।

## Manual security review

- [ ] Unauthenticated requests financial/admin endpoints access করতে পারে না।
- [ ] User A request path/body পাল্টে User B record পড়তে/লিখতে পারে না।
- [ ] CSRF token বা allowed Origin ছাড়া state mutation reject হয়।
- [ ] Cross-origin onrender login/logout/expiry Android Chrome ও restrictive cookie mode-এ যাচাই করা।
- [ ] Production CAPTCHA/real email verification tested; bypass off।
- [ ] Admin/self-approval/replay/state-transition boundaries tested।
- [ ] Concurrency/insufficient balance/duplicate settlement tests বাস্তব PostgreSQL-এ pass।
- [ ] Restricted DB role, immutable ledger/audit এবং nonnegative constraints verified।
- [ ] Reset link/token/secret browser history, logs, third-party referrer-এ leak হচ্ছে না।
- [ ] `npm audit --omit=dev` reviewed; full development-tool advisoryও triaged।
- [ ] Restore drill completed; secrets rotation ও incident owner assigned।
- [ ] Independent security review findings resolved before financial launch।

Security finding privately report করার জন্য operator নিজের monitored contact সেট করবেন। এই repository কোনো fictitious security email বা bug bounty reward তৈরি করে না।


## Archive verification limit

Read RELEASE_STATUS.md: full build, database integration, browser and vulnerability tests were not executed here. Offline syntax/import checks do not constitute a security audit. RLS policies are trusted-server policies, not per-user tenant SQL policies. Runtime role must not be database owner in production. User-facing balances are ledger-derived; wallet posting is a subledger, not a complete general ledger.

Production cookies include Partitioned for compatible Android browsers. Verify actual cookie behavior before launch. Phone OTP and MFA remain Not configured. No safe-upload endpoint exists; evidence is text/reference only, so arbitrary file uploads are intentionally not accepted.
