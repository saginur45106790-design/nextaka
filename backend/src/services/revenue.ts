import { financialTransaction, gate, eligibleUser, audit, minor, nonnegativeMinor, fundedReserve, AppError } from './core.js';
export async function createRevenue(actorId: string, key: string, input: { operationId: string; reference: string; grossMinor: string; operatingCostMinor: string; periodStartsAt: string; periodEndsAt: string; evidence: string }) {
  return financialTransaction(actorId, key, 'revenue-create', input, async tx => {
    const gross = minor(input.grossMinor), cost = nonnegativeMinor(input.operatingCostMinor);
    if (cost > gross || new Date(input.periodStartsAt) >= new Date(input.periodEndsAt) || new Date(input.periodEndsAt) > new Date()) throw new AppError(400, 'INVALID_REVENUE', 'Revenue requires a completed operating period and nonnegative net proceeds.');
    const operation = await tx.miningOperation.findUnique({ where: { id: input.operationId } });
    if (operation?.status !== 'VERIFIED') throw new AppError(409, 'UNVERIFIED_OPERATION', 'Verify the underlying operation first.');
    const result = await tx.miningRevenue.create({ data: { operationId: input.operationId, reference: input.reference.trim().toUpperCase(), grossMinor: gross, operatingCostMinor: cost, netMinor: gross - cost, periodStartsAt: new Date(input.periodStartsAt), periodEndsAt: new Date(input.periodEndsAt), evidence: input.evidence, createdById: actorId } });
    await audit(tx, actorId, 'REVENUE_RECORDED', 'MiningRevenue', result.id); return result;
  });
}

export async function verifyRevenue(actorId: string, key: string, revenueId: string, input: { evidence: string; statementReference: string }) {
  return financialTransaction(actorId, key, 'revenue-verify', { revenueId, ...input }, async tx => {
    const revenue = await tx.miningRevenue.findUnique({ where: { id: revenueId } });
    if (!revenue || revenue.status !== 'PENDING') throw new AppError(409, 'INVALID_STATE', 'Revenue not pending verification.');
    if (revenue.createdById === actorId) throw new AppError(403, 'DUAL_REVIEW_REQUIRED', 'A different administrator must independently verify actual mining proceeds and costs.');
    await tx.revenueVerification.create({ data: { revenueId, verifiedById: actorId, evidence: input.evidence, statementReference: input.statementReference.trim().toUpperCase() } });
    const result = await tx.miningRevenue.update({ where: { id: revenueId }, data: { status: 'VERIFIED', verifiedAt: new Date() } });
    await audit(tx, actorId, 'REVENUE_VERIFIED', 'MiningRevenue', revenueId, input); return result;
  });
}

export async function allocateReward(actorId: string, key: string, input: { contractId: string; revenueId: string; reserveId: string; period: number; amountMinor: string }) {
  return financialTransaction(actorId, key, 'reward-allocate', input, async tx => {
    await gate(tx, 'settlements');
    const contract = await tx.machineContract.findUnique({ where: { id: input.contractId } });
    const revenue = await tx.miningRevenue.findUnique({ where: { id: input.revenueId }, include: { operation: true } });
    if (!contract || !['ACTIVE', 'REWARD_PENDING_VERIFICATION', 'COMPLETED'].includes(contract.status)) throw new AppError(409, 'INVALID_CONTRACT', 'The contract is not eligible.');
    await eligibleUser(tx, contract.userId);
    const period = input.period;
    if (!Number.isSafeInteger(period) || period < 1 || period > contract.durationDays) throw new AppError(400, 'INVALID_PERIOD', 'Period must be within the purchased operating duration.');
    const periodEnd = new Date(contract.startsAt.getTime() + period * 86_400_000);
    const periodStart = new Date(periodEnd.getTime() - 86_400_000);
    if (periodEnd > new Date() || periodEnd > contract.endsAt) throw new AppError(409, 'PERIOD_NOT_DUE', 'This 24-hour operating period is not complete.');
    if (!revenue || revenue.status !== 'VERIFIED' || revenue.operation.status !== 'VERIFIED' || revenue.operationId !== contract.operationId || revenue.periodStartsAt > periodStart || revenue.periodEndsAt < periodEnd) throw new AppError(409, 'UNVERIFIED_REVENUE', 'Verified net mining revenue covering the user operating period is required.');
    const amount = minor(input.amountMinor);
    const allocated = await tx.rewardAllocation.aggregate({ where: { contractId: contract.id }, _sum: { amountMinor: true } });
    if (amount > contract.dailyTargetMinor || (allocated._sum.amountMinor ?? 0n) + amount > contract.totalTargetMinor) throw new AppError(409, 'TARGET_EXCEEDED', 'Allocation exceeds the configured target cap; principal is already included.');
    if (revenue.netMinor - revenue.allocatedMinor < amount) throw new AppError(409, 'INSUFFICIENT_REVENUE', 'Actual verified net revenue is insufficient.');
    await fundedReserve(tx, input.reserveId, 'MINING', amount);
    const result = await tx.rewardAllocation.create({ data: { ...input, amountMinor: amount, approvedById: actorId } });
    await tx.miningRevenue.update({ where: { id: revenue.id }, data: { allocatedMinor: { increment: amount } } });
    await audit(tx, actorId, 'REWARD_ALLOCATED', 'RewardAllocation', result.id, { period, amountMinor: amount }); return result;
  });
}
/** Recovery is based on durable allocations; server timers never mint earnings. Expired contracts may settle only previously eligible periods. */
