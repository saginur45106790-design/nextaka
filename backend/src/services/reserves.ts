import { financialTransaction, audit, minor, AppError } from './core.js';
export async function createReserve(actorId: string, key: string, input: { purpose: string; sourceType: string; sourceReference: string; evidence: string; amountMinor: string }) {
  return financialTransaction(actorId, key, 'reserve-create', input, async tx => {
    if (!['MINING_PROCEEDS', 'OWNER_CAPITAL', 'EARNED_FEES'].includes(input.sourceType)) throw new AppError(400, 'INVALID_FUNDING_SOURCE', 'User deposits cannot be used as a reserve funding source.');
    const amount = minor(input.amountMinor);
    const result = await tx.payoutReserve.create({ data: { purpose: input.purpose, sourceType: input.sourceType, sourceReference: input.sourceReference.trim().toUpperCase(), evidence: input.evidence, fundedMinor: amount, availableMinor: amount, createdById: actorId } });
    await audit(tx, actorId, 'RESERVE_RECORDED', 'PayoutReserve', result.id); return result;
  });
}

export async function verifyReserve(actorId: string, key: string, reserveId: string, input: { evidence: string }) {
  return financialTransaction(actorId, key, 'reserve-verify', { reserveId, ...input }, async tx => {
    const reserve = await tx.payoutReserve.findUnique({ where: { id: reserveId } });
    if (!reserve || reserve.status !== 'PENDING') throw new AppError(409, 'INVALID_STATE', 'Reserve not pending verification.');
    if (reserve.createdById === actorId) throw new AppError(403, 'DUAL_REVIEW_REQUIRED', 'An independent administrator must confirm actual funding and its lawful source.');
    const result = await tx.payoutReserve.update({ where: { id: reserveId }, data: { status: 'VERIFIED', verifiedById: actorId, verifiedAt: new Date() } });
    await audit(tx, actorId, 'RESERVE_VERIFIED', 'PayoutReserve', reserveId, input); return result;
  });
}
