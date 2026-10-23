import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import * as f from '../src/finance.js';

const suite = describe;
const evidence = 'Test-only independently verified provider statement; never a production payment.';
const reason = 'Test-only verification of financial invariants.';
const key = () => randomUUID();
const day = 86_400_000;
let adminA: string, adminB: string, userId: string, otherUser: string, operationId: string, reserveId: string;
let contractId: string, revenueId: string;
const savedSettings = new Map<string, unknown>();
const savedEnv: Record<string, string | undefined> = {};
const gates = ['FINANCIAL_ACTIVITY_ENABLED', 'DURABLE_INFRASTRUCTURE_CONFIRMED', 'COMPLIANCE_APPROVED', 'PAYMENT_OPERATIONS_READY', 'BACKUPS_RESTORE_TESTED', 'SECURITY_REVIEW_APPROVED'];
const planId = `test-plan-${randomUUID()}`;
async function user(role = 'USER') {
  return prisma.user.create({ data: { email: `${randomUUID()}@example.test`, fullName: 'Finance test account', passwordHash: 'TEST_FIXTURE_NOT_A_REAL_PASSWORD', role, referralCode: randomUUID(), termsAcceptedAt: new Date(), emailVerifiedAt: new Date() } });
}
async function balance(id: string, kind: string) {
  return (await prisma.walletLedger.aggregate({ where: { account: { userId: id, kind } }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0n;
}
async function verifiedDeposit(id: string, amountMinor: string) {
  const deposit = await f.requestDeposit(id, key(), { provider: 'BKASH', amountMinor, reference: key(), senderAccount: '01700000000' });
  await f.verifyDeposit(adminA, key(), deposit.id, { amountMinor, settlementReference: key(), evidence, providerConfirmedAt: new Date().toISOString() });
  await f.reviewDeposit(adminB, key(), deposit.id, { action: 'APPROVE', reason });
  return deposit;
}

suite('PostgreSQL financial boundaries (dedicated disposable test database only)', () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.includes('test')) throw new Error('Integration tests require a local dedicated database with test in its name.');
    for (const gate of gates) { savedEnv[gate] = process.env[gate]; process.env[gate] = 'true'; }
    for (const setting of ['platform', 'payments', 'withdrawal', 'referral', 'promotion']) savedSettings.set(setting, (await prisma.siteSetting.findUnique({ where: { key: setting } }))?.value);
    const settings = {
      platform: { launchApproved: true, purchasesEnabled: true, depositsEnabled: true, withdrawalsEnabled: true, settlementsEnabled: true, maintenanceMode: false },
      payments: { bkash: { enabled: true, merchantAccount: 'test-fixture-only', instructions: 'Do not send real funds.' } },
      withdrawal: { minMinor: '100', maxMinor: '1000000', feeMinor: '0' },
      referral: { enabled: true, commissionMinor: '18000', thresholdMinor: '30000' },
      promotion: { enabled: true, amountMinor: '2000', campaign: 'WELCOME_TEST' },
    };
    for (const [name, value] of Object.entries(settings)) await prisma.siteSetting.upsert({ where: { key: name }, create: { key: name, value }, update: { value } });
    adminA = (await user('ADMIN')).id; adminB = (await user('ADMIN')).id; userId = (await user()).id; otherUser = (await user()).id;
    const op = await f.createOperation(adminA, key(), { reference: key(), providerReference: 'TEST-POOL', description: 'Test-only operation fixture, no actual mining represented.', arrangementEvidence: evidence }); operationId = op.id;
    await f.verifyOperation(adminB, key(), operationId, { evidence });
    const reserve = await f.createReserve(adminA, key(), { purpose: 'MINING', sourceType: 'MINING_PROCEEDS', sourceReference: key(), evidence, amountMinor: '1000000' }); reserveId = reserve.id;
    await f.verifyReserve(adminB, key(), reserveId, { evidence });
    const rev = await f.createRevenue(adminA, key(), { operationId, reference: key(), grossMinor: '1000000', operatingCostMinor: '0', periodStartsAt: new Date(Date.now() - 10 * day).toISOString(), periodEndsAt: new Date().toISOString(), evidence }); revenueId = rev.id;
    await f.verifyRevenue(adminB, key(), revenueId, { evidence, statementReference: key() });
    await prisma.machinePlan.create({ data: { id: planId, name: 'Test plan', priceMinor: 30000n, durationDays: 7, dailyTargetMinor: 5500n, totalTargetMinor: 38500n, enabled: true, operationId } });
  }, 30_000);
  afterAll(async () => {
    for (const [name, value] of savedSettings) {
      if (value) await prisma.siteSetting.update({ where: { key: name }, data: { value: value as never } });
    }
    for (const gate of gates) { if (savedEnv[gate] === undefined) delete process.env[gate]; else process.env[gate] = savedEnv[gate]; }
    await prisma.$disconnect();
  });
  it('fails closed on prelaunch even with a funded account', async () => {
    process.env.FINANCIAL_ACTIVITY_ENABLED = 'false';
    await expect(f.purchase(userId, key(), { planId })).rejects.toMatchObject({ code: 'PRELAUNCH' });
    process.env.FINANCIAL_ACTIVITY_ENABLED = 'true';
  });
  it('does not credit fake references or allow same-admin verification/approval', async () => {
    const d = await f.requestDeposit(userId, key(), { provider: 'BKASH', amountMinor: '30000', reference: key(), senderAccount: '01700000000' });
    await expect(f.reviewDeposit(adminB, key(), d.id, { action: 'APPROVE', reason })).rejects.toMatchObject({ code: 'UNVERIFIED_PAYMENT' });
    expect(await balance(userId, 'MAIN')).toBe(0n);
    await f.verifyDeposit(adminA, key(), d.id, { amountMinor: '30000', settlementReference: key(), evidence, providerConfirmedAt: new Date().toISOString() });
    await expect(f.reviewDeposit(adminA, key(), d.id, { action: 'APPROVE', reason })).rejects.toMatchObject({ code: 'DUAL_REVIEW_REQUIRED' });
    const approvalKey = key();
    await f.reviewDeposit(adminB, approvalKey, d.id, { action: 'APPROVE', reason });
    await f.reviewDeposit(adminB, approvalKey, d.id, { action: 'APPROVE', reason });
    expect(await balance(userId, 'MAIN')).toBe(30000n);
  });
  it('rolls back insufficient purchases without creating a contract', async () => {
    await expect(f.purchase(otherUser, key(), { planId })).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(await prisma.machineContract.count({ where: { userId: otherUser } })).toBe(0);
  });
  it('serializes concurrent purchases and binds idempotency to payload', async () => {
    const purchaseKey = key();
    const results = await Promise.allSettled([f.purchase(userId, purchaseKey, { planId }), f.purchase(userId, key(), { planId })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    contractId = (results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: string }>).value.id;
    expect(await balance(userId, 'MAIN')).toBe(0n);
    const successful = await prisma.idempotencyKey.findFirstOrThrow({ where: { actorId: userId, operation: 'purchase' } });
    const again = await f.purchase(userId, successful.key, { planId });
    expect(again.id).toBe(contractId);
    await expect(f.purchase(userId, successful.key, { planId: 'different' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('never mints money from the clock and rejects unverified or premature revenue allocations', async () => {
    expect((await f.settleRewards(adminA)).settled).toBe(0);
    await expect(f.allocateReward(adminA, key(), { contractId, revenueId, reserveId, period: 1, amountMinor: '5500' })).rejects.toMatchObject({ code: 'PERIOD_NOT_DUE' });
    await prisma.machineContract.update({ where: { id: contractId }, data: { startsAt: new Date(Date.now() - 2 * day), endsAt: new Date(Date.now() + 5 * day) } });
    const unverified = await f.createRevenue(adminA, key(), { operationId, reference: key(), grossMinor: '6000', operatingCostMinor: '0', periodStartsAt: new Date(Date.now() - 3 * day).toISOString(), periodEndsAt: new Date().toISOString(), evidence });
    await expect(f.allocateReward(adminA, key(), { contractId, revenueId: unverified.id, reserveId, period: 1, amountMinor: '5500' })).rejects.toMatchObject({ code: 'UNVERIFIED_REVENUE' });
    expect(await balance(userId, 'WITHDRAWAL')).toBe(0n);
  });
  it('allocates only funded verified revenue, settles once, and preserves reserve accounting', async () => {
    const prior = (await prisma.payoutReserve.findUniqueOrThrow({ where: { id: reserveId } })).availableMinor;
    await f.allocateReward(adminA, key(), { contractId, revenueId, reserveId, period: 1, amountMinor: '5500' });
    expect((await prisma.payoutReserve.findUniqueOrThrow({ where: { id: reserveId } })).availableMinor).toBe(prior - 5500n);
    await expect(f.allocateReward(adminA, key(), { contractId, revenueId, reserveId, period: 1, amountMinor: '5500' })).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
    expect((await f.settleRewards(adminA)).settled).toBe(1);
    expect((await f.settleRewards(adminA)).settled).toBe(0);
    expect(await balance(userId, 'WITHDRAWAL')).toBe(5500n);
  });
  it('atomically reserves concurrent withdrawals and releases cancelled funds during a pause', async () => {
    const input = { provider: 'BKASH', amountMinor: '5000', recipientAccount: '01700000000', recipientName: 'Test Recipient' };
    const results = await Promise.allSettled([f.requestWithdrawal(userId, key(), input), f.requestWithdrawal(userId, key(), input)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const withdrawal = (results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: string }>).value;
    expect(await balance(userId, 'WITHDRAWAL')).toBe(500n); expect(await balance(userId, 'RESERVED')).toBe(5000n);
    await expect(f.cancelWithdrawal(otherUser, key(), withdrawal.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    process.env.FINANCIAL_ACTIVITY_ENABLED = 'false';
    await f.cancelWithdrawal(userId, key(), withdrawal.id);
    process.env.FINANCIAL_ACTIVITY_ENABLED = 'true';
    expect(await balance(userId, 'WITHDRAWAL')).toBe(5500n); expect(await balance(userId, 'RESERVED')).toBe(0n);
  });
  it('requires an approved real qualifying deposit and independently funded referral reserve exactly once', async () => {
    const relation = await prisma.referralRelationship.create({ data: { referrerId: userId, referredId: otherUser } });
    const reserve = await f.createReserve(adminA, key(), { purpose: 'REFERRAL', sourceType: 'OWNER_CAPITAL', sourceReference: key(), evidence, amountMinor: '18000' });
    await f.verifyReserve(adminB, key(), reserve.id, { evidence });
    const fake = await f.requestDeposit(otherUser, key(), { provider: 'BKASH', amountMinor: '30000', reference: key(), senderAccount: '01700000000' });
    await expect(f.reviewReferral(adminA, key(), relation.id, { action: 'APPROVE', reason, reserveId: reserve.id, qualifyingDepositId: fake.id })).rejects.toMatchObject({ code: 'UNQUALIFIED_REFERRAL' });
    const real = await verifiedDeposit(otherUser, '30000');
    const approvalKey = key(); const input = { action: 'APPROVE', reason, reserveId: reserve.id, qualifyingDepositId: real.id };
    await f.reviewReferral(adminA, approvalKey, relation.id, input); await f.reviewReferral(adminA, approvalKey, relation.id, input);
    expect(await balance(userId, 'MAIN')).toBe(18000n);
    await expect(f.reviewReferral(adminA, key(), relation.id, input)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
  it('records promotional funds separately and rejects duplicate or risky awards', async () => {
    const reserve = await f.createReserve(adminA, key(), { purpose: 'PROMOTION', sourceType: 'OWNER_CAPITAL', sourceReference: key(), evidence, amountMinor: '4000' });
    await f.verifyReserve(adminB, key(), reserve.id, { evidence });
    await f.awardPromotion(adminA, key(), userId, { reserveId: reserve.id, reason });
    expect(await balance(userId, 'PROMOTIONAL')).toBe(2000n);
    expect(await balance(userId, 'WITHDRAWAL')).toBe(5500n);
    await expect(f.awardPromotion(adminA, key(), userId, { reserveId: reserve.id, reason })).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
    await prisma.riskFlag.create({ data: { userId: otherUser, type: 'REVIEW', reason } });
    await expect(f.awardPromotion(adminA, key(), otherUser, { reserveId: reserve.id, reason })).rejects.toMatchObject({ code: 'RISK_REVIEW' });
  });
  it('enforces immutable ledger and audit history in PostgreSQL, not just React', async () => {
    const ledger = await prisma.walletLedger.findFirstOrThrow({ where: { account: { userId } } });
    await expect(prisma.walletLedger.update({ where: { id: ledger.id }, data: { description: 'tampered' } })).rejects.toThrow();
    await expect(prisma.walletLedger.delete({ where: { id: ledger.id } })).rejects.toThrow();
    await expect(prisma.walletAccount.update({ where: { id: ledger.accountId }, data: { balanceMinor: 999999n } })).rejects.toThrow();
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { actorId: userId } });
    await expect(prisma.auditLog.delete({ where: { id: audit.id } })).rejects.toThrow();
    const rows = await prisma.$queryRaw<Array<{ difference: bigint }>>`SELECT a."balanceMinor" - COALESCE(SUM(l."amountMinor"),0)::bigint AS difference FROM "WalletAccount" a LEFT JOIN "WalletLedger" l ON a.id=l."accountId" GROUP BY a.id`;
    expect(rows.every(r => r.difference === 0n)).toBe(true);
  });
});
