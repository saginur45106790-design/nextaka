import { financialTransaction, audit, AppError } from './core.js';
export async function createOperation(actorId: string, key: string, input: { reference: string; providerReference: string; description: string; arrangementEvidence: string }) {
  return financialTransaction(actorId, key, 'operation-create', input, async tx => {
    const result = await tx.miningOperation.create({ data: { ...input, createdById: actorId } });
    await audit(tx, actorId, 'OPERATION_RECORDED', 'MiningOperation', result.id); return result;
  });
}

export async function verifyOperation(actorId: string, key: string, operationId: string, input: { evidence: string }) {
  return financialTransaction(actorId, key, 'operation-verify', { operationId, ...input }, async tx => {
    const operation = await tx.miningOperation.findUnique({ where: { id: operationId } });
    if (!operation || operation.status !== 'PENDING') throw new AppError(409, 'INVALID_STATE', 'Operation not pending verification.');
    if (operation.createdById === actorId) throw new AppError(403, 'DUAL_REVIEW_REQUIRED', 'An independent administrator must verify the lawful operating arrangement.');
    const result = await tx.miningOperation.update({ where: { id: operationId }, data: { status: 'VERIFIED', verifiedById: actorId, verifiedAt: new Date() } });
    await audit(tx, actorId, 'OPERATION_VERIFIED', 'MiningOperation', operationId, input); return result;
  });
}
