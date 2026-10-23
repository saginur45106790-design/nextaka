import { financialTransaction, gate, eligibleUser, post, audit, paymentReady, minor, nonnegativeMinor, setting, AppError } from './core.js';
import type { Prisma as PrismaTypes } from '@prisma/client';
type Tx = PrismaTypes.TransactionClient;
export async function requestWithdrawal(actorId: string, key: string, input: { provider: string; amountMinor: string; recipientAccount: string; recipientName: string }) {
  return financialTransaction(actorId, key, 'withdrawal-request', input, async tx => {
    await gate(tx, 'withdrawals'); await eligibleUser(tx, actorId); await paymentReady(tx, input.provider);
    const limits = await setting(tx, 'withdrawal', { minMinor: '10000', maxMinor: '10000000', feeMinor: '0' });
    const amount = minor(input.amountMinor), fee = nonnegativeMinor(limits.feeMinor);
    if (amount < minor(limits.minMinor) || amount > minor(limits.maxMinor) || fee >= amount) throw new AppError(400, 'WITHDRAWAL_LIMIT', 'Withdrawal amount or fee is outside the configured limits.');
    const result = await tx.withdrawalRequest.create({ data: { userId: actorId, provider: input.provider, amountMinor: amount, feeMinor: fee, recipientAccount: input.recipientAccount, recipientName: input.recipientName, reservation: { create: { amountMinor: amount } }, histories: { create: { status: 'REQUESTED', actorId, note: 'Withdrawal funds reserved; not yet paid.' } } } });
    await post(tx, actorId, 'WITHDRAWAL', -amount, 'WITHDRAWAL_RESERVE', result.id, `withdrawal:${result.id}:hold-out`, actorId, 'Withdrawal amount reserved, fee included.');
    await post(tx, actorId, 'RESERVED', amount, 'WITHDRAWAL_RESERVE', result.id, `withdrawal:${result.id}:hold-in`, actorId, 'Reserved pending provider settlement.');
    await audit(tx, actorId, 'WITHDRAWAL_REQUESTED', 'WithdrawalRequest', result.id); return result;
  });
}
async function releaseWithdrawal(tx: Tx, withdrawal: { id: string; userId: string; amountMinor: bigint }, actorId: string, status: string, reason: string) {
  await post(tx, withdrawal.userId, 'RESERVED', -withdrawal.amountMinor, 'WITHDRAWAL_RELEASE', withdrawal.id, `withdrawal:${withdrawal.id}:release-out`, actorId, reason);
  await post(tx, withdrawal.userId, 'WITHDRAWAL', withdrawal.amountMinor, 'WITHDRAWAL_RELEASE', withdrawal.id, `withdrawal:${withdrawal.id}:release-in`, actorId, reason);
  await tx.walletReservation.update({ where: { withdrawalRequestId: withdrawal.id }, data: { status: 'RELEASED', releasedAt: new Date() } });
  return tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status, rejectionReason: status === 'REJECTED' ? reason : null, histories: { create: { status, note: reason, actorId } } } });
}

export async function cancelWithdrawal(actorId: string, key: string, withdrawalId: string) {
  return financialTransaction(actorId, key, 'withdrawal-cancel', { withdrawalId }, async tx => {
    const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal || withdrawal.userId !== actorId) throw new AppError(404, 'NOT_FOUND', 'Withdrawal not found.');
    if (!['REQUESTED', 'UNDER_REVIEW'].includes(withdrawal.status)) throw new AppError(409, 'INVALID_STATE', 'A payment already approved or processing cannot be cancelled.');
    const result = await releaseWithdrawal(tx, withdrawal, actorId, 'CANCELLED', 'Cancelled by account holder.');
    await audit(tx, actorId, 'WITHDRAWAL_CANCELLED', 'WithdrawalRequest', withdrawalId); return result;
  });
}

export async function reviewWithdrawal(actorId: string, key: string, withdrawalId: string, input: { action: string; reason: string; settlementReference?: string; evidence?: string; settledAt?: string }) {
  return financialTransaction(actorId, key, 'withdrawal-review', { withdrawalId, ...input }, async tx => {
    const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal || ['PAID', 'REJECTED', 'CANCELLED'].includes(withdrawal.status)) throw new AppError(409, 'INVALID_STATE', 'This withdrawal is final.');
    if (withdrawal.userId === actorId) throw new AppError(403, 'SELF_REVIEW', 'Administrators cannot review their own withdrawals.');
    if (input.action === 'REJECT') {
      if (withdrawal.status === 'PROCESSING') throw new AppError(409, 'PAYMENT_IN_FLIGHT', 'A processing withdrawal requires provider reconciliation before rejection; do not release potentially paid funds.');
      const result = await releaseWithdrawal(tx, withdrawal, actorId, 'REJECTED', input.reason); await audit(tx, actorId, 'WITHDRAWAL_REJECTED', 'WithdrawalRequest', withdrawalId, input); return result;
    }
    const transitions: Record<string, { from: string[]; to: string }> = {
      REVIEW: { from: ['REQUESTED'], to: 'UNDER_REVIEW' }, APPROVE: { from: ['REQUESTED', 'UNDER_REVIEW'], to: 'APPROVED' }, PROCESS: { from: ['APPROVED'], to: 'PROCESSING' }, PAID: { from: ['PROCESSING'], to: 'PAID' },
    };
    const transition = transitions[input.action];
    if (!transition || !transition.from.includes(withdrawal.status)) throw new AppError(409, 'INVALID_STATE', 'Invalid withdrawal status transition.');
    if (input.action !== 'REVIEW') { await gate(tx, 'withdrawals'); await eligibleUser(tx, withdrawal.userId); }
    if (input.action === 'PAID') {
      if (!input.settlementReference || !input.evidence || !input.settledAt || new Date(input.settledAt) > new Date()) throw new AppError(400, 'SETTLEMENT_EVIDENCE_REQUIRED', 'Verified provider reference, evidence and settlement time are required.');
      if (withdrawal.reviewedById === actorId) throw new AppError(403, 'DUAL_REVIEW_REQUIRED', 'A different administrator must confirm the actual payout.');
      await tx.withdrawalSettlement.create({ data: { withdrawalId, provider: withdrawal.provider, settlementReference: input.settlementReference.trim().toUpperCase(), evidence: input.evidence, settledById: actorId, settledAt: new Date(input.settledAt) } });
      await post(tx, withdrawal.userId, 'RESERVED', -withdrawal.amountMinor, 'WITHDRAWAL_PAID', withdrawalId, `withdrawal:${withdrawalId}:paid`, actorId, `Provider payout confirmed; net ${withdrawal.amountMinor - withdrawal.feeMinor} paisa, fee ${withdrawal.feeMinor} paisa.`);
      await tx.walletReservation.update({ where: { withdrawalRequestId: withdrawalId }, data: { status: 'PAID', releasedAt: new Date() } });
    }
    const result = await tx.withdrawalRequest.update({ where: { id: withdrawalId }, data: { status: transition.to, ...(input.action === 'APPROVE' ? { reviewedById: actorId } : {}), histories: { create: { status: transition.to, note: input.reason, actorId } } } });
    await audit(tx, actorId, `WITHDRAWAL_${transition.to}`, 'WithdrawalRequest', withdrawalId, input); return result;
  });
}
