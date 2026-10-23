# আর্থিক কার্যক্রমের operating checklist

এই application নিজে mining hardware, pool বা bank account নয়। Software record-এর সঙ্গে বাইরের বাস্তব statement মিলিয়ে দায়িত্বশীল মানুষ verification করবেন। Administrator role পাওয়া মানে টাকা বা revenue বানানোর অনুমতি পাওয়া নয়।

## অর্থের হিসাব

| অর্থের ধরন | অনুমোদিত উৎস | ব্যবহার |
|---|---|---|
| Main cash | স্বাধীনভাবে verified deposit; funded approved referral credit; audited authorized correction | অনুমোদিত package purchase |
| Withdrawal cash | verified mining revenue-এর funded allocation settle হওয়া | withdrawal request |
| Promotional credit | enabled promotion ও documented budget | আলাদা nonwithdrawable balance; cash হিসেবে গণনা নয় |
| Reserved withdrawal | request-এর সময় atomically reserved cash | settlement/rejection না হওয়া পর্যন্ত পুনর্ব্যবহার নয় |

BDT-এর ১ টাকা = ১০০ paisa। API-তে `30000` string মানে ৳৩০০; floating-point অর্থ নয়। Ledger ইতিহাস immutable; balance ledger-এর সঙ্গে reconcile করতে হবে। Cached account balance সংশোধনের জন্য সরাসরি SQL update গ্রহণযোগ্য operating procedure নয়।

Configured target:

| Machine | Purchase | Days | Daily target | Total target | Target net gain |
|---|---:|---:|---:|---:|---:|
| 1 | ৳300 | 7 | ৳55 | ৳385 | ৳85 |
| 2 | ৳500 | 7 | ৳95 | ৳665 | ৳165 |
| 3 | ৳1,000 | 7 | ৳200 | ৳1,400 | ৳400 |
| 4 | ৳5,000 | 15 | ৳400 | ৳6,000 | ৳1,000 |
| 5 | ৳10,000 | 30 | ৳460 | ৳13,800 | ৳3,800 |

Total target-এ purchase amount ইতিমধ্যে অন্তর্ভুক্ত। মেয়াদ শেষে principal আবার স্বয়ংক্রিয়ভাবে ফেরত দেওয়া যাবে না। Target সম্ভাব্য business allocation, নিশ্চিত mining profitability নয়; actual eligible revenue কম হলে credit-ও কম বা শূন্য হতে পারে।

## দায়িত্ব ভাগ

কমপক্ষে দুজন অনুমোদিত reviewer রাখুন। Evidence প্রস্তুতকারী ও verifier আলাদা হবেন। তাঁদের ব্যক্তিগত verified account ব্যবহার করুন; admin password share করবেন না। Provider account-এ read-only access সম্ভব হলে আলাদা রাখুন। Evidence URL-এর storage private রাখুন, কিন্তু authorized reviewer-এর জন্য accessible হতে হবে। Public URL-এ customer identity/payment statement দেবেন না।

## Mining operation প্রস্তুত করা

1. Owner/legal entity, physical বা contractual operation reference, pool/provider reference এবং lawful revenue arrangement সংগ্রহ করুন। Document-এর তারিখ, parties, scope ও cancellation conditions স্পষ্ট করুন।
2. Admin → Mining operations-এ real reference ও evidence record করুন। দ্বিতীয় reviewer actual document/source যাচাই করে verify করবেন।
3. যে package সেই operation-এর capacity/arrangement দ্বারা সমর্থিত, কেবল সেটিকে link ও enable করুন। Package targets prospective contract terms-এর সঙ্গে মেলে কি না review করুন।
4. Hardware uptime, network difficulty, operating costs, exchange/conversion risk, counterparty risk ও no-guarantee disclosure public content-এ প্রকাশ করুন। কোনো hashrate বা rig ownership প্রমাণ ছাড়া দাবি করবেন না।

## Reserve নিশ্চিত করা

1. User deposits থেকে আলাদা payout funding account/control রাখুন। Allowed documented source যেমন প্রকৃত mining proceeds, owner capital অথবা independently earned fee।
2. Admin → Reserves-এ amount, funding source, independent settlement reference ও evidence দিন। `USER_DEPOSITS`-কে mining reward reserve হিসেবে ব্যবহার করবেন না।
3. দ্বিতীয় administrator bank/provider statement থেকে funds received এবং source সত্যতা যাচাই করবেন। Database-এ amount লেখা bank-এ cash আসার প্রমাণ নয়।
4. Funding capacity বরাদ্দের সঙ্গে কমে; একই reserve বারবার allocation-এ ব্যবহার করা যাবে না। Campaign marketing/promotion budget-ও অন্য দায় থেকে আলাদা রাখুন।

## Revenue record → allocation → settlement

1. Operation-এর প্রকৃত revenue period, gross revenue, operating cost, settlement reference এবং evidence সংগ্রহ করুন। Cost deduct করার পরে net distributable amount লিখুন।
2. দ্বিতীয় reviewer pool/provider/bank statement থেকে independently verify করবেন। Reference reused কি না, amount এবং timestamp মেলে কি না দেখুন।
3. Eligible contract ও ২৪ ঘণ্টার reward period-এর জন্য allocation তৈরি করুন। Verified net revenue ও reserve capacity—দুটির সীমার মধ্যে থাকতে হবে। Configured daily target allocation-এর source নয়।
4. Cron/authorized settlement command due funded allocation process করে withdrawal wallet credit করবে। প্রতিটি settlement-এর ledger linkage থাকবে। Browser counter বা clock input গ্রহণযোগ্য নয়।
5. Interrupted cron আবার চালানো যায়; existing unique settlement পুনরায় credit হয় না। শুধু due historical periods recover করুন; contract শেষ হওয়ার পরে নতুন reward period তৈরি করবেন না।
6. Admin reconciliation-এ credited amount, revenue allocated, reserve use এবং withdrawal liabilities মিলিয়ে দেখুন। কোনো mismatch হলে নতুন financial activity pause করুন।

## Manual bKash/Nagad deposit

1. Approved merchant account, provider terms ও settlement access নিশ্চিত করুন। Admin payment instructions-এ কেবল authorized merchant তথ্য দিন। Payment credentials/server secret browser-এ দেবেন না।
2. User-এর request `Pending` অবস্থায় থাকে। Submitted reference বা screenshot কোনো wallet credit নয়।
3. Reviewer provider dashboard/independently confirmed settlement record-এ amount, merchant recipient, timestamp, payer/reference এবং uniqueness মিলিয়ে evidence record করবেন।
4. আলাদা approver সেই evidence verify করে approve করবেন। Approval atomically main cash এবং immutable ledger entry তৈরি করবে। একই request/reference আবার credit করতে পারবে না।
5. Mismatch/fake reference হলে reason দিয়ে reject করুন। User support/appeal করতে পারবেন। Evidence/file upload adapter না থাকলে private controlled evidence reference ব্যবহার করুন; arbitrary executable upload enable করবেন না।

## Withdrawal

1. User eligible withdrawal cash থেকে request দেন এবং security confirmation সম্পন্ন করেন। Amount ও applicable fee server config থেকে যাচাই হয়।
2. Funds একবার atomically reserve হবে; concurrent request-এর জন্য একই funds পাওয়া যাবে না।
3. Reviewer account status, recipient, applicable compliance requirements ও reserve reconciliation পরীক্ষা করে approve/processing করবেন।
4. Authorized payment operator provider-এর মাধ্যমে প্রকৃত transfer করবেন। App বর্তমানে provider-এ নিজে টাকা পাঠায়—এমন দাবি করবেন না।
5. আলাদা verifier settlement reference/amount independently confirm করার পর `Paid` mark করবেন। Paid হওয়ার পরে ledger/history immutable থাকে।
6. Allowed pending অবস্থায় cancellation অথবা rejection হলে reservation release করুন। Transfer বাইরে সম্পন্ন হয়ে গেলে status back করে refund দেখাবেন না; investigate ও audited correction workflow ব্যবহার করুন।

## Referral এবং welcome promotion

Welcome target ৳২০, default disabled এবং nonwithdrawable promotional credit। Verified identity eligibility, fraud review ও promotion budget ছাড়া award নয়। Cash wallet দিয়ে একই credit মিশিয়ে ফেলবেন না।

Referral target ৳১৮০; qualifying independently verified transaction threshold ৳৩০০। Self-referral, repeated qualification বা duplicate commission নিষিদ্ধ। Request জমা দিলেই qualification নয়। Marketing budget/independently earned fee-এর প্রকৃত funding record এবং fraud review ছাড়া approval নয়। Campaign disabled থাকলে নতুন promise করবেন না।

একই IP/phone device signal সন্দেহের কারণ হতে পারে, কিন্তু mobile CGNAT বা পরিবার legitimate shared network ব্যবহার করতে পারে। Manual review ও appeals রাখুন; একটি signal দিয়ে সবাইকে automatic ban নয়।

## Launch gates

Backend এবং cron environment-এর চারটি gate:

```text
FINANCIAL_ACTIVITY_ENABLED
DURABLE_INFRASTRUCTURE_CONFIRMED
COMPLIANCE_APPROVED
PAYMENT_OPERATIONS_READY
```

Database `platform` settings-এ `launchApproved`, `purchasesEnabled`, `depositsEnabled`, `withdrawalsEnabled`, `settlementsEnabled` এবং `maintenanceMode` আলাদাভাবে নিয়ন্ত্রণ করা হয়। Env `true` কোনো external evidence verify করে না। Free infrastructure-এ সব env gate false রাখুন। Admin settings-এর সুবিধা থাকলেও source-level funding constraints নিষ্ক্রিয় করা যাবে না।

## দৈনিক দায়িত্ব

- Provider settlement totals বনাম approved deposits/paid withdrawals মিলিয়ে sign-off।
- Ledger বনাম account balances, active reservations এবং payout liability reconcile।
- Pending verification, stale withdrawal, failed cron, failed email ও support complaints review।
- Budget/reserve remaining এবং duplicate references review।
- Backup success/restore evidence এবং audit trail completeness পরীক্ষা।

Incident হলে নতুন deposits/purchases/settlements বন্ধ করুন, in-flight payout provider-এর সঙ্গে মিলিয়ে নিন, evidence সংরক্ষণ করুন, দায়িত্বশীল reviewer ও user-support process সক্রিয় করুন। Historical ledger delete বা timestamps বদলে incident ঢাকবেন না। প্রয়োজনীয় correction-এ original entry reference, reason, authorizer এবং immutable compensating entry থাকতে হবে; unsupported correction API থাকলে financial launch বন্ধ রাখুন যতক্ষণ reviewed migration/service দিয়ে নিরাপদ procedure প্রস্তুত হয়।


## Additional archive controls

Six independent environment gates include BACKUPS_RESTORE_TESTED and SECURITY_REVIEW_APPROVED in addition to the original four. No positive target is evidence of revenue. SQL enforces a lifetime one-time promotion per user even if campaign names change. Contract refunds are constrained to no-allocation contracts and use a linked immutable reversal. Already allocated contracts require independent legal/financial reconciliation; no unrestricted override exists.

Internal reconciliation takes the same lock as financial posting and compares wallet caches, held reservations and reserve consumption. This is not a provider/bank custody audit. Manual evidence must be independently genuine; software cannot authenticate an arbitrary pasted statement by itself.
