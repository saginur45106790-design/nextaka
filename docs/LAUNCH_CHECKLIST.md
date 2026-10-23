# Financial launch checklist — all items required

- [ ] Full npm build, ESLint, unit, PostgreSQL integration and browser tests pass on the final commit.
- [ ] Dependency audit reviewed; supported Node/runtime versions pinned via committed dependency lock.
- [ ] Independent security review; administrator authentication/recovery strength and least privilege reviewed.
- [ ] Durable database and always-on service selected; Free PostgreSQL never used for money.
- [ ] Backup export, off-host encrypted storage and restore drill evidenced.
- [ ] Runtime DB role configured; migration credentials kept out of running application where possible.
- [ ] Legal operator identity, monitored support, jurisdiction-specific legal/compliance review and privacy/terms approved.
- [ ] Approved merchant accounts, actual provider records and payment settlement procedure tested.
- [ ] Real mining operation and lawful arrangement independently verified.
- [ ] Real gross revenue/cost/net proceeds independently verified; adequate independent reserves actually received.
- [ ] Marketing/promotion reserves distinct from user deposits; campaign eligibility and limits approved.
- [ ] Two independent administrators available; no shared credentials.
- [ ] Actual Android Chrome registration, verification, login, reset, refresh and logout pass on deployed origins.
- [ ] Third-party cookie behavior validated; custom domains configured if needed.
- [ ] Scheduled settlement deployed independently of sleeping web process; interruption/retry recovery demonstrated.
- [ ] Provider reconciliation and incident-response owners assigned; no uncertain payment automatically retried.
- [ ] Limits, refund rights and financial retention reviewed locally; no guaranteed profit claims.

Only after evidence review may operator set all six env gates true:
FINANCIAL_ACTIVITY_ENABLED, DURABLE_INFRASTRUCTURE_CONFIRMED,
COMPLIANCE_APPROVED, PAYMENT_OPERATIONS_READY, BACKUPS_RESTORE_TESTED,
SECURITY_REVIEW_APPROVED.

The same gates apply to the settlement service. DB platform launchApproved and each activityEnabled flag must also be true. Verify purchases/deposits/withdrawals/settlements separately with controlled low limits. Turning flags on is an attestation, not automatic proof that any external requirement is satisfied.

During incidents, disable financial activity and DB activity flags. Preserve evidence. A processing withdrawal must not be released until provider reconciliation proves it was not paid. User cancellations before approval can still release existing holds during a pause.
