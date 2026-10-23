# Android থেকে ZIP → GitHub

1. ZIP download করে Files/ZArchiver/Acode-এর মাধ্যমে extract করুন। `nextaka` folder খুলুন।
2. ভিতরে `backend`, `frontend`, `docs`, `scripts`, `.github`, `package.json`, `render.yaml` আছে কি না দেখুন। Hidden files দেখানোর setting চালু করুন।
3. GitHub-এ `nextaka` repository খুলুন। আগে তৈরি `backend/package.json`, `tsconfig.json`, `vitest.config.ts` এই ZIP-এর সংস্করণ দিয়ে replace করতে হবে। দুই সংস্করণের files মেশাবেন না।
4. Browser-এর Desktop site চালু করে Add file → Upload files ব্যবহার করুন। **ZIP archive নিজে upload করলে source deploy হবে না**; GitHub archive expand করে না। Folder selection browserভেদে নাও চলতে পারে; প্রয়োজনে Codespaces পদ্ধতি নিন।
5. GitHub browser upload-এ এক batch-এ file limit থাকতে পারে। ১২৮টি file ছোট batches-এ দিন এবং relative folder paths ঠিক রাখুন। `nextaka/nextaka/frontend` ভুল; repository root থেকে `frontend` থাকবে।

## Codespaces পদ্ধতি

Repository → Code → Codespaces → Create codespace। Explorer-এ ZIP upload করুন। Terminal থেকে `unzip` দিয়ে আলাদা folder-এ extract করুন; তারপর extracted folder-এর contents repository root-এ আনুন। Existing source overwrite করার আগে Git commit/backup নিন। Codespaces billing/quota আপনার account-এ দেখুন।

`.env`, database dump, password বা API secret upload করবেন না। `.env.example` খালি configuration guide হিসেবে নিরাপদ।

## Commit-এর পরে

Actions → NEXTAKA checks খুলুন। Green status ছাড়া tested ধরে নেবেন না। Build failure হলে log-এর প্রথম relevant error দেখে ঠিক করুন। CI-এর generated dependency lock artifact download করে repository root-এ `package-lock.json` হিসেবে commit করুন। তারপর install command `npm ci --include=dev` করা যায়।

এই archive-এ actual financial records নেই। Test fixtures শুধু isolated automated test database-এর জন্য।
