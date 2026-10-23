# Frontend routes

| Route | Behavior |
|---|---|
| `/` | Public landing, five real configured plan records, FAQ, targets and risks |
| `/login` | Email/verified-phone sign-in with CAPTCHA |
| `/register?ref=CODE` | Registration, referral attribution, terms acceptance |
| `/verify-email#token=...` | Single-use email verification |
| `/forgot-password` | Recovery request with CAPTCHA |
| `/reset-password#token=...` | Reset password and revoke sessions |
| `/dashboard` | Backend balances, stats, verified rewards chart, contracts, ledger |
| `/machines` | Package targets, purchase confirmation, contract progress and settlements |
| `/wallet?tab=deposit` | Configured provider instructions and persistent requests |
| `/wallet?tab=withdraw` | Confirmed withdrawal reservation and history |
| `/transactions` | Search, pagination, transaction details/print |
| `/referrals` | Real link/code/statistics, copy/share, qualification history |
| `/profile` | Profile, password, sessions, security events and deletion request |
| `/notifications` | Personal notifications and mark-read |
| `/support` | Create ticket, status and admin response |
| `/help` | Public help/contact and recovery guidance |
| `/legal/terms`, `/legal/privacy`, `/legal/risk`, `/legal/refund` | Truthful pre-launch policy text with admin-configured content |
| `/admin?section=...` | Role-protected operational console, 20 main sections plus operations/reserves |

Admin section keys: overview, users, verifications, plans, contracts, revenues, deposits, withdrawals, referrals, ledger, reconciliation, notifications, content, announcements, support, risk, audit, settings, security, backups. Operations/reserves appear under mining revenue. Selected page reports can be exported as sanitized JSON.

Layout: desktop sidebar, mobile bottom navigation, 320px CSS breakpoint, Bangla default with English switch, local fonts bundled from npm, native accessible dialogs, error/loading/empty states, reduced-motion rules and lightweight CSS/SVG rigs. Rig visuals are illustrations, not evidence of installed hardware.
