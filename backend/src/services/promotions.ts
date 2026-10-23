import { financialTransaction, gate, eligibleUser, post, audit, minor, setting, fundedReserve, AppError } from './core.js';
export async function awardPromotion(actorId: string, key: string, userId: string, input: { reserveId: string; reason: string }) {
  return financialTransaction(actorId, key, 'promotion-award', { userId, ...input }, async tx => {
    await gate(tx, 'purchases'); await eligibleUser(tx, userId);
    if (userId === actorId) throw new AppError(403, 'SELF_REVIEW', 'Administrators cannot award themselves promotions.');
    const campaign = await setting(tx, 'promotion', { enabled: false, amountMinor: '2000', campaign: 'WELCOME_V1' });
    if (campaign.enabled !== true) throw new AppError(423, 'CAMPAIGN_DISABLED', 'The welcome promotion is disabled.');
    const amount = minor(campaign.amountMinor);
    await fundedReserve(tx, input.reserveId, 'PROMOTION', amount);
    const result = await tx.promotionalCredit.create({ data: { userId, campaign: campaign.campaign, reserveId: input.reserveId, amountMinor: amount, reviewedById: actorId } });
    await post(tx, userId, 'PROMOTIONAL', amount, 'PROMOTION', result.id, `promotion:${userId}:${campaign.campaign}`, actorId, 'Non-withdrawable promotional credit; not cash.');
    await audit(tx, actorId, 'PROMOTION_AWARDED', 'PromotionalCredit', result.id, { reason: input.reason }); return result;
  });
}
