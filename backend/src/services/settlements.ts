import { gate, post, audit, prisma, json } from './core.js';
export async function settleRewards(actorId: string | null = null) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(817362910)`;
    await gate(tx, 'settlements');
    const allocations = await tx.rewardAllocation.findMany({ where: { status: 'APPROVED', settlement: null, contract: {status: {in: ['ACTIVE','REWARD_PENDING_VERIFICATION','COMPLETED']}, user: {status:'ACTIVE',emailVerifiedAt:{not:null},riskFlags:{none:{status:'OPEN'}}},operation:{status:'VERIFIED'}},revenue:{status:'VERIFIED'},reserve:{status:'VERIFIED'} }, include: { contract: { include: { user: true, operation: true } }, revenue: true, reserve: true }, orderBy: { createdAt: 'asc' }, take: 250 });
    let settled = 0, deferred = 0;
    for (const allocation of allocations) {
      const contract = allocation.contract;
      const due = new Date(contract.startsAt.getTime() + allocation.period * 86_400_000);
      if (due > new Date() || due > contract.endsAt || !['ACTIVE', 'REWARD_PENDING_VERIFICATION', 'COMPLETED'].includes(contract.status) || contract.user.status !== 'ACTIVE' || !contract.user.emailVerifiedAt || contract.operation.status !== 'VERIFIED' || allocation.revenue.status !== 'VERIFIED' || allocation.reserve.status !== 'VERIFIED' || await tx.riskFlag.count({ where: { userId: contract.userId, status: 'OPEN' } })) { deferred++; continue; }
      const settlement = await tx.miningSettlement.create({ data: { contractId: contract.id, allocationId: allocation.id, period: allocation.period, amountMinor: allocation.amountMinor } });
      await post(tx, contract.userId, 'WITHDRAWAL', allocation.amountMinor, 'MINING_REWARD', settlement.id, `settlement:${allocation.id}`, actorId, `Verified mining revenue allocation for period ${allocation.period}.`);
      await tx.rewardAllocation.update({ where: { id: allocation.id }, data: { status: 'SETTLED' } });
      await audit(tx, actorId, 'REWARD_SETTLED', 'MiningSettlement', settlement.id, { allocationId: allocation.id }); settled++;
    }
    await tx.machineContract.updateMany({ where: { status: { in: ['ACTIVE', 'REWARD_PENDING_VERIFICATION'] }, endsAt: { lte: new Date() } }, data: { status: 'COMPLETED' } });
    const result = { settled, deferred, scanned: allocations.length, moreMayRemain: allocations.length === 250, timestamp: new Date().toISOString() };
    await tx.auditLog.create({ data: { actorId, action: 'SETTLEMENT_RUN', targetType: 'MiningSettlement', metadata: json(result) } });
    return result;
  }, { maxWait: 10_000, timeout: 30_000 });
}
