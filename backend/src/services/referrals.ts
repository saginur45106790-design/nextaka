import { financialTransaction, gate, eligibleUser, post, audit, minor, setting, fundedReserve, AppError } from './core.js';
export async function reviewReferral(actorId: string, key: string, relationshipId: string, input: { action: string; reason: string; reserveId?: string; qualifyingDepositId?: string }) {
  return financialTransaction(actorId, key, 'referral-review', { relationshipId, ...input }, async tx => {
    const relationship = await tx.referralRelationship.findUnique({ where: { id: relationshipId } });
    if (!relationship || !['PENDING', 'QUALIFIED'].includes(relationship.status)) throw new AppError(409, 'INVALID_STATE', 'Referral is already reviewed or missing.');
    if (input.action === 'REJECT') {
      const result = await tx.referralRelationship.update({ where: { id: relationshipId }, data: { status: 'REJECTED' } }); await audit(tx, actorId, 'REFERRAL_REJECTED', 'ReferralRelationship', relationshipId, { reason: input.reason }); return result;
    }
    await gate(tx, 'purchases');
    const campaign = await setting(tx, 'referral', { enabled: false, commissionMinor: '18000', thresholdMinor: '30000' });
    if (campaign.enabled !== true) throw new AppError(423, 'CAMPAIGN_DISABLED', 'The referral campaign is suspended.');
    if (relationship.referrerId === relationship.referredId || actorId === relationship.referrerId || actorId === relationship.referredId) throw new AppError(403, 'SELF_REVIEW', 'Self-referrals or self-review are not permitted.');
    await eligibleUser(tx, relationship.referrerId); await eligibleUser(tx, relationship.referredId);
    const deposit = await tx.depositRequest.findUnique({ where: { id: input.qualifyingDepositId ?? '' }, include: { verification: true } });
    if (!deposit || deposit.userId !== relationship.referredId || deposit.status !== 'APPROVED' || !deposit.verification || deposit.amountMinor < minor(campaign.thresholdMinor) || deposit.createdAt < relationship.createdAt) throw new AppError(409, 'UNQUALIFIED_REFERRAL', 'A real, approved qualifying deposit and fraud review are required.');
    const amount = minor(campaign.commissionMinor);
    await fundedReserve(tx, input.reserveId ?? '', 'REFERRAL', amount);
    const result = await tx.referralCommission.create({ data: { relationshipId, userId: relationship.referrerId, reserveId: input.reserveId!, amountMinor: amount, qualifyingDepositId: deposit.id, reviewNote: input.reason, reviewedById: actorId } });
    await post(tx, relationship.referrerId, 'MAIN', amount, 'REFERRAL_COMMISSION', result.id, `referral:${relationshipId}`, actorId, 'Approved referral commission funded by the documented marketing reserve.');
    await tx.referralRelationship.update({ where: { id: relationshipId }, data: { status: 'APPROVED' } });
    await audit(tx, actorId, 'REFERRAL_APPROVED', 'ReferralCommission', result.id, { reason: input.reason }); return result;
  });
}
