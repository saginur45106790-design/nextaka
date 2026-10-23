import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const plans = [
  ['machine-1', 'Machine 1', 30000n, 7, 5500n, 38500n],
  ['machine-2', 'Machine 2', 50000n, 7, 9500n, 66500n],
  ['machine-3', 'Machine 3', 100000n, 7, 20000n, 140000n],
  ['machine-4', 'Machine 4', 500000n, 15, 40000n, 600000n],
  ['machine-5', 'Machine 5', 1000000n, 30, 46000n, 1380000n],
] as const;
async function main() {
  for (const [id, name, priceMinor, durationDays, dailyTargetMinor, totalTargetMinor] of plans) {
    await prisma.machinePlan.upsert({ where: { id }, update: {}, create: { id, name, priceMinor, durationDays, dailyTargetMinor, totalTargetMinor, enabled: false, specifications: { model: name, hardware: 'Not configured', hashrate: 'Not verified', location: 'Not configured', revenueModel: 'Verified mining revenue only', targetIncludesPrincipal: true } } });
  }
  const values = {
    platform: { launchApproved: false, purchasesEnabled: false, depositsEnabled: false, withdrawalsEnabled: false, settlementsEnabled: false, maintenanceMode: false },
    payments: { bkash: { enabled: false, instructions: '', merchantAccount: '' }, nagad: { enabled: false, instructions: '', merchantAccount: '' } },
    promotion: { enabled: false, amountMinor: '2000', campaign: 'WELCOME_V1' },
    referral: { enabled: false, commissionMinor: '18000', thresholdMinor: '30000' },
    withdrawal: { minMinor: '10000', maxMinor: '10000000', feeMinor: '0' },
    content: { supportEmail: '', operatorLegalName: '', legalReviewReference: '', termsVersion: '2026-10-prelaunch' },
  };
  for (const [key, value] of Object.entries(values)) await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  console.info('Seeded five disabled package targets and pre-launch settings. No users, money, revenue or transactions were created.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Seed failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
