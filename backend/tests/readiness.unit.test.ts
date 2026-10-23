import { afterEach,describe,expect,it,vi } from 'vitest';
import { financialStatus } from '../src/finance.js';
import type { PrismaClient } from '@prisma/client';
const flags=['FINANCIAL_ACTIVITY_ENABLED','DURABLE_INFRASTRUCTURE_CONFIRMED','COMPLIANCE_APPROVED','PAYMENT_OPERATIONS_READY','BACKUPS_RESTORE_TESTED','SECURITY_REVIEW_APPROVED'];
const db={miningOperation:{count:async()=>1},miningRevenue:{count:async()=>1},payoutReserve:{count:async()=>1},siteSetting:{findUnique:async()=>({value:{launchApproved:true,maintenanceMode:false}})}} as unknown as PrismaClient;
afterEach(()=>vi.unstubAllEnvs());
describe('launch gates',()=>{
 it.each(flags)('fails closed without %s',async missing=>{for(const key of flags)vi.stubEnv(key,key===missing?'false':'true');expect((await financialStatus(db)).financialEnabled).toBe(false);});
 it('does not treat 1 as an approval',async()=>{for(const key of flags)vi.stubEnv(key,'1');expect((await financialStatus(db)).mode).toBe('PRELAUNCH');});
});
