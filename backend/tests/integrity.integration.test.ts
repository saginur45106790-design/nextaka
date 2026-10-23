import {randomUUID} from 'node:crypto';
import {describe,expect,it,afterAll} from 'vitest';
import {prisma} from '../src/db.js';
import {session} from './http.js';
import {reviewContract} from '../src/finance.js';
describe('PostgreSQL invariants and immutable corrections',()=>{
 afterAll(()=>prisma.$disconnect());
 it('rejects direct nonzero wallets and self referrals',async()=>{
  const {user}=await session();
  await expect(prisma.walletAccount.create({data:{userId:user.id,kind:'MAIN',balanceMinor:500n}})).rejects.toThrow();
  await expect(prisma.referralRelationship.create({data:{referrerId:user.id,referredId:user.id}})).rejects.toThrow();
 });
 it('does not allow an anonymous SQL role to read private tables',async()=>{
  const rows=await prisma.$queryRaw<{allowed:boolean}[]>`SELECT EXISTS(SELECT 1 FROM information_schema.table_privileges WHERE table_schema='public' AND table_name='User' AND grantee='PUBLIC' AND privilege_type='SELECT') AS allowed`;
  expect(rows[0]?.allowed).toBe(false);
 });
 it('allows only balanced linked reversals and prevents duplicate refunds',async()=>{
  const admin=await session('ADMIN'),member=await session();
  const op=await prisma.miningOperation.create({data:{reference:randomUUID(),providerReference:'TEST-ONLY',description:'Isolated fixture for reversal integrity',arrangementEvidence:'Test fixture, not actual revenue',createdById:admin.user.id}});
  const plan=await prisma.machinePlan.create({data:{id:`test-${randomUUID()}`,name:'Test plan',priceMinor:30000n,dailyTargetMinor:5500n,totalTargetMinor:38500n,durationDays:7}});
  const account=await prisma.walletAccount.create({data:{userId:member.user.id,kind:'MAIN'}});
  await prisma.walletLedger.create({data:{accountId:account.id,amountMinor:30000n,eventKey:randomUUID(),kind:'TEST_FIXTURE',referenceId:randomUUID(),description:'Isolated test funding, never seeded in production'}});
  const contract=await prisma.machineContract.create({data:{userId:member.user.id,planId:plan.id,operationId:op.id,priceMinor:30000n,dailyTargetMinor:5500n,totalTargetMinor:38500n,durationDays:7,endsAt:new Date(Date.now()+7*86400000)}});
  const debit=await prisma.walletLedger.create({data:{accountId:account.id,amountMinor:-30000n,eventKey:`purchase:${contract.id}`,kind:'PURCHASE',referenceId:contract.id,description:'Isolated test purchase'}});
  await expect(prisma.walletLedger.create({data:{accountId:account.id,amountMinor:1n,eventKey:randomUUID(),kind:'REVERSAL',referenceId:contract.id,reversalOfId:debit.id,description:'Invalid partial reversal test'}})).rejects.toThrow();
  const key=randomUUID();await reviewContract(admin.user.id,key,contract.id,{action:'REFUND',reason:'Independent test of immutable purchase refund'});
  await reviewContract(admin.user.id,key,contract.id,{action:'REFUND',reason:'Independent test of immutable purchase refund'});
  expect((await prisma.walletAccount.findUniqueOrThrow({where:{id:account.id}})).balanceMinor).toBe(30000n);
  expect(await prisma.walletLedger.count({where:{reversalOfId:debit.id}})).toBe(1);
 });
});
