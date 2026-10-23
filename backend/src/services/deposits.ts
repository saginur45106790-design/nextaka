import { financialTransaction, gate, eligibleUser, post, audit, paymentReady, minor, AppError } from './core.js';
export async function requestDeposit(actorId: string, key: string, input: { provider: string; amountMinor: string; reference: string; senderAccount: string }) {
  return financialTransaction(actorId, key, 'deposit-request', input, async tx => {
    await gate(tx, 'deposits'); await eligibleUser(tx, actorId); await paymentReady(tx, input.provider);
    const result = await tx.depositRequest.create({ data: { ...input, amountMinor: minor(input.amountMinor), userId: actorId, reference: input.reference.trim().toUpperCase(), histories: { create: { status: 'PENDING', note: 'Submitted for independent provider verification; no wallet credit.', actorId } } } });
    await audit(tx, actorId, 'DEPOSIT_REQUESTED', 'DepositRequest', result.id);
    return result;
  });
}

export async function verifyDeposit(actorId: string, key: string, depositId: string, input: { settlementReference: string; amountMinor: string; evidence: string; providerConfirmedAt: string }) {
  return financialTransaction(actorId, key, 'deposit-verify', { depositId, ...input }, async tx => {
    const deposit = await tx.depositRequest.findUnique({ where: { id: depositId } });
    if (!deposit || !['PENDING', 'UNDER_REVIEW'].includes(deposit.status)) throw new AppError(409, 'INVALID_STATE', 'The deposit is not awaiting verification.');
    if (deposit.userId === actorId) throw new AppError(403, 'SELF_REVIEW', 'Administrators cannot verify their own deposits.');
    const amount = minor(input.amountMinor);
    if (amount !== deposit.amountMinor) throw new AppError(409, 'AMOUNT_MISMATCH', 'The independently verified amount must match the request.');
    if (new Date(input.providerConfirmedAt) > new Date()) throw new AppError(400, 'INVALID_DATE', 'The provider confirmation cannot be in the future.');
    const record = await tx.paymentVerification.create({ data: { depositId, provider: deposit.provider, settlementReference: input.settlementReference.trim().toUpperCase(), amountMinor: amount, evidence: input.evidence, verifiedById: actorId, providerConfirmedAt: new Date(input.providerConfirmedAt) } });
    await tx.depositRequest.update({ where: { id: depositId }, data: { status: 'UNDER_REVIEW', histories: { create: { status: 'UNDER_REVIEW', actorId, note: 'Independent provider settlement evidence recorded; approval still required.' } } } });
    await audit(tx, actorId, 'DEPOSIT_EVIDENCE_VERIFIED', 'DepositRequest', depositId, { verificationId: record.id });
    return record;
  });
}

export async function reviewDeposit(actorId: string, key: string, depositId: string, input: { action: string; reason: string }) {
  return financialTransaction(actorId, key, 'deposit-review', { depositId, ...input }, async tx => {
    const deposit = await tx.depositRequest.findUnique({ where: { id: depositId }, include: { verification: true } });
    if (!deposit || !['PENDING', 'UNDER_REVIEW'].includes(deposit.status)) throw new AppError(409, 'INVALID_STATE', 'This deposit cannot be reviewed.');
    if (deposit.userId === actorId) throw new AppError(403, 'SELF_REVIEW', 'Administrators cannot approve their own deposits.');
    const status = input.action === 'APPROVE' ? 'APPROVED' : input.action === 'REJECT' ? 'REJECTED' : 'UNDER_REVIEW';
    if (status === 'APPROVED') {
      await gate(tx, 'deposits'); await eligibleUser(tx, deposit.userId);
      if (!deposit.verification || deposit.verification.amountMinor !== deposit.amountMinor) throw new AppError(409, 'UNVERIFIED_PAYMENT', 'A submitted reference or screenshot alone cannot create wallet funds. Provider settlement verification is required.');
      if (deposit.verification.verifiedById === actorId) throw new AppError(403, 'DUAL_REVIEW_REQUIRED', 'A different administrator must approve the verified deposit.');
      await post(tx, deposit.userId, 'MAIN', deposit.amountMinor, 'DEPOSIT', deposit.id, `deposit:${deposit.id}`, actorId, 'Independently confirmed deposit approved.');
    }
    const result = await tx.depositRequest.update({ where: { id: depositId }, data: { status, reviewedById: actorId, reviewedAt: new Date(), rejectionReason: status === 'REJECTED' ? input.reason : null, histories: { create: { status, note: input.reason, actorId } } } });
    await audit(tx, actorId, `DEPOSIT_${status}`, 'DepositRequest', deposit.id, { reason: input.reason }); return result;
  });
}

export async function cancelDeposit(actorId:string,key:string,depositId:string){
 return financialTransaction(actorId,key,'deposit-cancel',{depositId},async tx=>{
  const d=await tx.depositRequest.findUnique({where:{id:depositId}});
  if(!d||d.userId!==actorId)throw new AppError(404,'NOT_FOUND','Deposit not found.');
  if(d.status!=='PENDING')throw new AppError(409,'INVALID_STATE','Only pending deposits can be cancelled; contact support for settled funds.');
  const result=await tx.depositRequest.update({where:{id:depositId},data:{status:'CANCELLED',histories:{create:{status:'CANCELLED',actorId,note:'Cancelled by user. Any independently received payment requires operator reconciliation.'}}}});
  await audit(tx,actorId,'DEPOSIT_CANCELLED','DepositRequest',depositId);return result;
 });
}
