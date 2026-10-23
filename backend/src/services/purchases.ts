import { financialTransaction, gate, eligibleUser, post, audit, AppError } from './core.js';
export async function purchase(actorId: string, key: string, input: { planId: string }) {
  return financialTransaction(actorId, key, 'purchase', input, async tx => {
    await gate(tx, 'purchases'); await eligibleUser(tx, actorId);
    const plan = await tx.machinePlan.findUnique({ where: { id: input.planId }, include: { operation: true } });
    if (!plan?.enabled || !plan.operation || plan.operation.status !== 'VERIFIED' || !plan.operation.verifiedAt) throw new AppError(409, 'PLAN_UNAVAILABLE', 'This package has no verified operating arrangement or is unavailable.');
    const verifiedRevenue = await tx.miningRevenue.count({ where: { operationId: plan.operation.id, status: 'VERIFIED' } });
    const funded = await tx.payoutReserve.aggregate({ where: { purpose: 'MINING', status: 'VERIFIED' }, _sum: { availableMinor: true } });
    if (!verifiedRevenue || (funded._sum.availableMinor ?? 0n) < plan.dailyTargetMinor) throw new AppError(409, 'MINING_NOT_READY', 'A verified mining revenue source and adequate authorized reserves are required.');
    const now = new Date();
    const contract = await tx.machineContract.create({ data: { userId: actorId, planId: plan.id, operationId: plan.operation.id, priceMinor: plan.priceMinor, dailyTargetMinor: plan.dailyTargetMinor, totalTargetMinor: plan.totalTargetMinor, durationDays: plan.durationDays, startsAt: now, endsAt: new Date(now.getTime() + plan.durationDays * 86_400_000) } });
    await post(tx, actorId, 'MAIN', -plan.priceMinor, 'PURCHASE', contract.id, `purchase:${contract.id}`, actorId, `${plan.name} purchase; principal is included in the distribution target.`);
    await audit(tx, actorId, 'CONTRACT_PURCHASED', 'MachineContract', contract.id);
    return contract;
  });
}

export async function reviewContract(actorId:string,key:string,contractId:string,input:{action:string;reason:string}){
 return financialTransaction(actorId,key,'contract-review',{contractId,...input},async tx=>{
  const contract=await tx.machineContract.findUnique({where:{id:contractId}});
  if(!contract)throw new AppError(404,'NOT_FOUND','Contract not found.');
  if(contract.userId===actorId)throw new AppError(403,'SELF_REVIEW','Administrators cannot review their own contracts.');
  if(['CANCELLED','REFUNDED','COMPLETED'].includes(contract.status))throw new AppError(409,'INVALID_STATE','This contract is final.');
  let status:string;
  if(input.action==='PAUSE'){status='SUSPENDED';}
  else if(input.action==='RESUME'){
   await gate(tx,'purchases');await eligibleUser(tx,contract.userId);
   if(contract.status!=='SUSPENDED'||contract.endsAt<=new Date())throw new AppError(409,'INVALID_STATE','Only unexpired suspended contracts can resume.');status='ACTIVE';
  }else if(input.action==='REFUND'){
   if(await tx.rewardAllocation.count({where:{contractId}}))throw new AppError(409,'RECONCILIATION_REQUIRED','Allocated contracts require independent reconciliation before a refund; no automatic reversal is safe.');
   const original=await tx.walletLedger.findUnique({where:{eventKey:`purchase:${contractId}`}});
   if(!original||original.amountMinor!==-contract.priceMinor)throw new AppError(409,'RECONCILIATION_REQUIRED','Original purchase entry is missing or inconsistent.');
   await tx.walletLedger.create({data:{accountId:original.accountId,amountMinor:contract.priceMinor,eventKey:`refund:${contractId}`,kind:'PURCHASE_REFUND',referenceId:contractId,description:input.reason,actorId,reversalOfId:original.id}});
   status='REFUNDED';
  }else throw new AppError(400,'INVALID_ACTION','Unsupported contract action.');
  const result=await tx.machineContract.update({where:{id:contractId},data:{status}});
  await audit(tx,actorId,`CONTRACT_${status}`,'MachineContract',contractId,{reason:input.reason});return result;
 });
}
