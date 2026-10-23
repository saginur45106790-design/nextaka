# External services কীভাবে সংযুক্ত করবেন

## Turnstile

Cloudflare dashboard → Turnstile → widget তৈরি করুন। Actual Render frontend hostname allow করুন। Public site key frontend `VITE_TURNSTILE_SITE_KEY` এবং backend `TURNSTILE_SITE_KEY`-এ দিন। Secret শুধু backend `TURNSTILE_SECRET_KEY`-এ। Backend `TURNSTILE_HOSTNAMES`-এ hostname দিন, `https://` নয়। Register/login/forgot_password action backend ও widget-এ মিলে যায়। Wrong hostname/action fail closed হবে।

## Email

এই release-এর adapter Resend HTTPS API ব্যবহার করে। Sender domain provider-এ verify করুন; API key শুধু backend EMAIL_API_KEY-এ এবং অনুমোদিত sender EMAIL_FROM-এ দিন। Render Free-এর SMTP port restrictions এড়াতে SMTP ব্যবহার করা হয়নি। Provider production approval/quota/billing যাচাই করুন। Free `onrender.com` hostname-এর DNS আপনি নিয়ন্ত্রণ করেন না, তাই সেটি দিয়ে নিজের sender domain verify করা যাবে ধরে নেবেন না। নিজস্ব DNS-controlled domain বা provider-approved sender লাগতে পারে; domain কেনায় খরচ হতে পারে।

শুধু test sender থাকলে arbitrary users-কে mail deliver হবে দাবি করবেন না। নিজের বাস্তব mailbox-এ verification/reset test করুন; delivery logs দেখুন, token প্রকাশ করবেন না। SUPPORT_EMAIL-এ monitored mailbox দিন।

## bKash / Nagad

Approved merchant account ও operating permission আগে সংগ্রহ করুন। Admin Settings → payments-এ merchant account/instructions দিন। Secret PIN বা payment API key এখানে দেওয়া নিষিদ্ধ। Database instruction frontend-এ প্রকাশ্য হতে পারে। Financial readiness না হওয়া পর্যন্ত method disabled রাখুন।

বর্তমান flow manual independent provider statement review। Typed reference বা screenshot দিয়ে approval নয়। Admin A independently verify করেন, Admin B approval দেন। Official API adapter interface `backend/src/payment-provider.ts`-এ আছে; official adapters-এর registry খালি এবং UI API configuration false। Provider documentation/approved credentials ছাড়া API implementation দাবি করা হয়নি।

## Actual mining

Admin → Mining revenue → Operations-এ বাস্তব provider/pool reference, lawful arrangement এবং evidence reference দিন। ভিন্ন admin independently verify করবেন। এরপর completed period-এর gross receipts, operating costs ও real statement evidence দিন। Independent verifier statementReference দিয়ে যাচাই করবেন।

Reserves-এ একই টাকা আবার একাধিক reserve হিসেবে গণনা করবেন না। User deposits reserve source নয়। Actual received mining proceeds/owner capital/earned fees-এর bank/provider record নথিভুক্ত করুন। Reward allocation-এ correct operation, completed 24h contract period এবং verified reserve ব্যবহার করুন। কোনো target amount জোর করে actual revenue বানাবেন না।

Phone OTP ও MFA এই release-এ **Not configured**। Provider ছাড়া verified badge বা functional OTP দাবি নেই।
