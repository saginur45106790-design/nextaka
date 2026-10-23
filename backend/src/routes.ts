import { officialProviderConfigured } from './payment-provider.js';
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { config, emailConfigured } from './config.js';
import { AppError } from './errors.js';
import { financialStatus } from './finance.js';
import { requireAuth, rateLimit, event } from './security.js';

export const publicRouter = Router();
export const userRouter = Router();
const asObject = (value: Prisma.JsonValue | undefined): Record<string, Prisma.JsonValue> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function pagination(query: Record<string, unknown>) {
  const page = z.coerce.number().int().min(1).max(100000).catch(1).parse(query.page);
  const pageSize = z.coerce.number().int().min(1).max(50).catch(20).parse(query.pageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
export async function walletTotals(userId: string) {
  const accounts = await prisma.walletAccount.findMany({ where: { userId } });
  const totals = await prisma.walletLedger.groupBy({ by: ['accountId'], where: { accountId: { in: accounts.map((a) => a.id) } }, _sum: { amountMinor: true } });
  const amount = (kind: string) => totals.find((x) => x.accountId === accounts.find((a) => a.kind === kind)?.id)?._sum.amountMinor ?? 0n;
  return { mainMinor: amount('MAIN'), withdrawalMinor: amount('WITHDRAWAL'), promotionalMinor: amount('PROMOTIONAL'), reservedMinor: amount('RESERVED') };
}

publicRouter.get('/config', async (_req, res) => {
  const [status, plans, announcements, settings] = await Promise.all([
    financialStatus(), prisma.machinePlan.findMany({ orderBy: { priceMinor: 'asc' } }),
    prisma.announcement.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, take: 5 }), prisma.siteSetting.findMany(),
  ]);
  const get = (key: string) => asObject(settings.find((s) => s.key === key)?.value);
  const payments = get('payments');
  res.json({ data: { ...status, plans, announcements, paymentMethods: ['bkash', 'nagad'].map((provider) => {
    const method = asObject(payments[provider]); return { provider, officialApiConfigured: officialProviderConfigured(provider.toUpperCase() as 'BKASH'|'NAGAD'), enabled: method.enabled === true && status.financialEnabled, instructions: status.financialEnabled ? method.instructions ?? '' : '', merchantAccount: status.financialEnabled ? method.merchantAccount ?? '' : '' };
  }), referral: { enabled: false, commissionMinor: '18000', thresholdMinor: '30000', ...get('referral') },
  promotion: { enabled: false, amountMinor: '2000', ...get('promotion') }, supportEmail: config.SUPPORT_EMAIL ?? null,
  content: get('content'), maintenanceMode: get('platform').maintenanceMode === true,
  turnstileSiteKey: config.TURNSTILE_SITE_KEY ?? null, captchaConfigured: Boolean(config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY),
  emailConfigured, phoneVerificationConfigured: false, mfaConfigured: false } });
});

userRouter.use(requireAuth);
userRouter.get('/dashboard', async (req, res) => {
  const userId = req.user!.id;
  const [wallet, deposits, withdrawals, rewards, pendingRewards, contracts, transactions, announcements, notifications] = await Promise.all([
    walletTotals(userId), prisma.depositRequest.aggregate({ where: { userId, status: 'APPROVED' }, _sum: { amountMinor: true } }),
    prisma.withdrawalRequest.aggregate({ where: { userId, status: 'PAID' }, _sum: { amountMinor: true } }),
    prisma.miningSettlement.aggregate({ where: { contract: { userId } }, _sum: { amountMinor: true } }),
    prisma.rewardAllocation.aggregate({ where: { contract: { userId }, status: 'APPROVED', settlement: null }, _sum: { amountMinor: true } }),
    prisma.machineContract.findMany({ where: { userId }, include: { plan: true, settlements: true, allocations: { select: { id: true, period: true, amountMinor: true, status: true, createdAt: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.walletLedger.findMany({ where: { account: { userId } }, include: { account: { select: { kind: true } } }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.announcement.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  const [activeMachines, completedMachines] = await Promise.all([
    prisma.machineContract.count({ where: { userId, status: { in: ['ACTIVE', 'REWARD_PENDING_VERIFICATION', 'REWARD_CREDITED'] } } }),
    prisma.machineContract.count({ where: { userId, status: 'COMPLETED' } }),
  ]);
  const lastRevenue = await prisma.miningRevenue.findFirst({where:{status:'VERIFIED',operation:{contracts:{some:{userId}}}},orderBy:{verifiedAt:'desc'},select:{verifiedAt:true}});
  res.json({ data: { wallet, lastVerifiedRevenueAt: lastRevenue?.verifiedAt ?? null, stats: { depositedMinor: deposits._sum.amountMinor ?? 0n, withdrawnMinor: withdrawals._sum.amountMinor ?? 0n,
    rewardsMinor: rewards._sum.amountMinor ?? 0n, pendingRewardsMinor: pendingRewards._sum.amountMinor ?? 0n, activeMachines, completedMachines },
    contracts, transactions, announcements, notifications } });
});

userRouter.get('/activity', async(req,res)=>{
 const rows=await prisma.$queryRaw<Array<{day:string;amountMinor:bigint;count:bigint}>>`
 SELECT to_char((s."settledAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS day,
 SUM(s."amountMinor")::bigint AS "amountMinor", COUNT(*)::bigint AS count
 FROM "MiningSettlement" s JOIN "MachineContract" c ON c.id=s."contractId"
 WHERE c."userId"=${req.user!.id}::uuid AND s."settledAt">=CURRENT_TIMESTAMP-INTERVAL '7 days'
 GROUP BY day ORDER BY day`;
 res.json({data:rows});
});
userRouter.get('/transactions', async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const search = z.string().max(100).catch('').parse(req.query.search);
  const where: Prisma.WalletLedgerWhereInput = { account: { userId: req.user!.id }, ...(search ? { OR: [{ description: { contains: search, mode: 'insensitive' } }, { kind: { contains: search, mode: 'insensitive' } }] } : {}) };
  const [items, total] = await Promise.all([prisma.walletLedger.findMany({ where, include: { account: { select: { kind: true } } }, orderBy: { createdAt: 'desc' }, skip, take }), prisma.walletLedger.count({ where })]);
  res.json({ data: { items, total, page, pageSize } });
});
userRouter.get('/contracts', async (req, res) => res.json({ data: await prisma.machineContract.findMany({ where: { userId: req.user!.id }, include: { plan: true, settlements: true, allocations: { select: { id: true, period: true, amountMinor: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }) }));
userRouter.get('/deposits', async (req, res) => res.json({ data: await prisma.depositRequest.findMany({ where: { userId: req.user!.id }, include: { histories: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 100 }) }));
userRouter.get('/withdrawals', async (req, res) => res.json({ data: await prisma.withdrawalRequest.findMany({ where: { userId: req.user!.id }, include: { histories: { orderBy: { createdAt: 'asc' } }, settlement: { select: { settlementReference: true, settledAt: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }) }));
userRouter.get('/referrals', async (req, res) => {
  const relations = await prisma.referralRelationship.findMany({ where: { referrerId: req.user!.id }, select: { id: true, status: true, createdAt: true, commission: { select: { amountMinor: true, status: true, createdAt: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  const [total, pending, qualified, earned] = await Promise.all([
    prisma.referralRelationship.count({ where: { referrerId: req.user!.id } }), prisma.referralRelationship.count({ where: { referrerId: req.user!.id, status: 'PENDING' } }),
    prisma.referralRelationship.count({ where: { referrerId: req.user!.id, status: { in: ['QUALIFIED', 'APPROVED'] } } }),
    prisma.referralCommission.aggregate({ where: { userId: req.user!.id, status: 'APPROVED' }, _sum: { amountMinor: true } }),
  ]);
  res.json({ data: { code: req.user!.referralCode, url: `${config.FRONTEND_URL}/register?ref=${req.user!.referralCode}`, stats: { total, pending, qualified, earnedMinor: earned._sum.amountMinor ?? 0n }, items: relations } });
});
userRouter.get('/notifications', async (req, res) => res.json({ data: await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 100 }) }));
userRouter.post('/notifications/:id/read', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const updated = await prisma.notification.updateMany({ where: { id, userId: req.user!.id }, data: { readAt: new Date() } });
  if (!updated.count) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  res.json({ data: { success: true } });
});
userRouter.get('/support', async (req, res) => res.json({ data: await prisma.supportTicket.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 100 }) }));
userRouter.post('/support', rateLimit('support', 10, 3_600_000), async (req, res) => {
  const input = z.object({ subject: z.string().trim().min(4).max(150), message: z.string().trim().min(10).max(5000) }).parse(req.body);
  res.status(201).json({ data: await prisma.supportTicket.create({ data: { ...input, userId: req.user!.id } }) });
});
userRouter.post('/account/deletion-request', rateLimit('account-deletion', 3, 86_400_000), async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user!.id }, data: { deletionRequestedAt: new Date() } }),
    prisma.supportTicket.create({ data: { userId: req.user!.id, subject: 'Account deletion request', message: reason } }),
  ]);
  await event(req, 'DELETION_REQUESTED', req.user!.id);
  res.json({ data: { message: 'Request recorded for review. Financial and security records may require lawful retention.' } });
});
userRouter.get('/security/events', async (req, res) => res.json({ data: await prisma.securityEvent.findMany({ where: { userId: req.user!.id }, select: { id: true, type: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }) }));
userRouter.get('/security/sessions', async (req, res) => res.json({ data: await prisma.session.findMany({ where: { userId: req.user!.id, expiresAt: { gt: new Date() } }, select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true }, orderBy: { lastSeenAt: 'desc' } }) }));
userRouter.post('/security/sessions/:id/revoke', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  await prisma.session.deleteMany({ where: { id, userId: req.user!.id } });
  await event(req, 'SESSION_REVOKED', req.user!.id);
  res.json({ data: { success: true } });
});
