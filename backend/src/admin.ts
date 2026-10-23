import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { AppError } from './errors.js';
import { requireAuth, requireAdmin } from './security.js';
import { financialStatus } from './finance.js';
import { pagination } from './routes.js';
import { config, emailConfigured } from './config.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
const reason = z.string().trim().min(10).max(2000);
const minor = z.string().regex(/^(0|[1-9]\d{0,12})$/);
const positiveMinor = minor.refine((v) => BigInt(v) > 0n, 'Amount must be positive.');
const userSelect = { id: true, email: true, fullName: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true, role: true, status: true, createdAt: true, deletionRequestedAt: true };
const json = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, v: unknown) => typeof v === 'bigint' ? v.toString() : v)) as Prisma.InputJsonValue;

adminRouter.get('/overview', async (_req, res) => {
  const startDay = new Date(); startDay.setUTCHours(0, 0, 0, 0);
  const startMonth = new Date(Date.UTC(startDay.getUTCFullYear(), startDay.getUTCMonth(), 1));
  const [registeredUsers, verifiedUsers, activeMachines, pendingDeposits, approvedDeposits, pendingWithdrawals, paidWithdrawals, revenues, liabilities, pendingCommissions, reserves, dailyTransactions, monthlyTransactions, status] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { emailVerifiedAt: { not: null } } }), prisma.machineContract.count({ where: { status: 'ACTIVE' } }),
    prisma.depositRequest.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }), prisma.depositRequest.aggregate({ where: { status: 'APPROVED' }, _sum: { amountMinor: true } }),
    prisma.withdrawalRequest.count({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'] } } }), prisma.withdrawalRequest.aggregate({ where: { status: 'PAID' }, _sum: { amountMinor: true } }),
    prisma.miningRevenue.aggregate({ where: { status: 'VERIFIED' }, _sum: { netMinor: true } }),
    prisma.walletLedger.aggregate({ where: { account: { kind: { in: ['WITHDRAWAL', 'RESERVED'] } } }, _sum: { amountMinor: true } }),
    prisma.referralRelationship.count({ where: { status: { in: ['PENDING', 'QUALIFIED'] } } }), prisma.payoutReserve.aggregate({ where: { status: 'VERIFIED' }, _sum: { availableMinor: true } }),
    prisma.walletLedger.count({ where: { createdAt: { gte: startDay } } }), prisma.walletLedger.count({ where: { createdAt: { gte: startMonth } } }), financialStatus(),
  ]);
  res.json({ data: { registeredUsers, verifiedUsers, activeMachines, pendingDeposits, approvedDepositsMinor: approvedDeposits._sum.amountMinor ?? 0n,
    pendingWithdrawals, paidWithdrawalsMinor: paidWithdrawals._sum.amountMinor ?? 0n, verifiedMiningRevenueMinor: revenues._sum.netMinor ?? 0n,
    withdrawableLiabilitiesMinor: liabilities._sum.amountMinor ?? 0n, pendingCommissions, availableReservesMinor: reserves._sum.availableMinor ?? 0n,
    dailyTransactions, monthlyTransactions, ...status } });
});

adminRouter.post('/users/:id/status', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED']), reason }).strict().parse(req.body);
  if (id === req.user!.id) throw new AppError(400, 'SELF_RESTRICTION', 'An administrator cannot restrict their own account.');
  const user = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(817362910)`;
    const updated = await tx.user.update({ where: { id }, data: { status: input.status }, select: userSelect });
    if (input.status !== 'ACTIVE') await tx.session.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'USER_STATUS_CHANGED', targetType: 'User', targetId: id, metadata: input } });
    return updated;
  });
  res.json({ data: user });
});

adminRouter.patch('/plans/:id', async (req, res) => {
  const id = z.string().min(1).max(60).parse(req.params.id);
  const input = z.object({ name: z.string().min(2).max(100).optional(), priceMinor: positiveMinor.optional(), durationDays: z.number().int().min(1).max(365).optional(),
    dailyTargetMinor: positiveMinor.optional(), totalTargetMinor: positiveMinor.optional(), enabled: z.boolean().optional(), operationId: z.uuid().nullable().optional(), reason }).strict().parse(req.body);
  const { reason: explanation, ...fields } = input;
  const current = await prisma.machinePlan.findUnique({ where: { id } });
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Plan not found.');
  const daily = BigInt(fields.dailyTargetMinor ?? current.dailyTargetMinor);
  const total = BigInt(fields.totalTargetMinor ?? current.totalTargetMinor);
  if (daily * BigInt(fields.durationDays ?? current.durationDays) !== total) throw new AppError(400, 'TARGET_MISMATCH', 'Total target must equal daily target multiplied by duration. Total already includes principal.');
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.machinePlan.update({ where: { id }, data: { name: fields.name, enabled: fields.enabled, operationId: fields.operationId, durationDays: fields.durationDays, priceMinor: fields.priceMinor ? BigInt(fields.priceMinor) : undefined, dailyTargetMinor: daily, totalTargetMinor: total } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'PLAN_UPDATED', targetType: 'MachinePlan', targetId: id, metadata: { reason: explanation, before: json(current), after: json(record) } } });
    return record;
  });
  res.json({ data: updated });
});

adminRouter.post('/announcements', async (req, res) => {
  const input = z.object({ title: z.string().trim().min(3).max(150), message: z.string().trim().min(10).max(5000), published: z.boolean().default(false) }).strict().parse(req.body);
  const record = await prisma.$transaction(async (tx) => {
    const record = await tx.announcement.create({ data: { ...input, createdById: req.user!.id } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'ANNOUNCEMENT_CREATED', targetType: 'Announcement', targetId: record.id, metadata: input } });
    return record;
  });
  res.status(201).json({ data: record });
});
adminRouter.patch('/announcements/:id', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = z.object({ title: z.string().min(3).max(150).optional(), message: z.string().min(10).max(5000).optional(), published: z.boolean().optional(), reason }).strict().parse(req.body);
  const { reason: explanation, ...fields } = input;
  const record = await prisma.$transaction(async (tx) => {
    const record = await tx.announcement.update({ where: { id }, data: fields });
    await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'ANNOUNCEMENT_UPDATED', targetType: 'Announcement', targetId: id, metadata: { ...fields, reason: explanation } } });
    return record;
  });
  res.json({ data: record });
});
adminRouter.patch('/support/:id', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']), adminReply: z.string().trim().min(1).max(5000) }).strict().parse(req.body);
  const record = await prisma.$transaction(async (tx) => {
    const record = await tx.supportTicket.update({ where: { id }, data: { ...input, repliedById: req.user!.id } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'SUPPORT_REPLIED', targetType: 'SupportTicket', targetId: id, metadata: { status: input.status } } });
    await tx.notification.create({ data: { userId: record.userId, title: 'সাপোর্ট উত্তর / Support reply', message: `Your ticket “${record.subject}” has a new response.` } });
    return record;
  });
  res.json({ data: record });
});
adminRouter.post('/notifications', async (req, res) => {
  const input = z.object({ userId: z.uuid(), title: z.string().trim().min(3).max(150), message: z.string().trim().min(3).max(2000) }).strict().parse(req.body);
  const record = await prisma.$transaction(async (tx) => {
    const record = await tx.notification.create({ data: input });
    await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'NOTIFICATION_CREATED', targetType: 'Notification', targetId: record.id, metadata: { userId: input.userId } } });
    return record;
  });
  res.status(201).json({ data: record });
});

const methodSchema = z.object({ enabled: z.boolean(), instructions: z.string().max(3000), merchantAccount: z.string().max(100) }).strict().refine((v) => !v.enabled || (v.instructions.trim().length >= 10 && v.merchantAccount.trim().length >= 5), 'Enabled methods need merchant instructions and a merchant account.');
const settingsSchemas = {
  platform: z.object({ launchApproved: z.boolean(), purchasesEnabled: z.boolean(), depositsEnabled: z.boolean(), withdrawalsEnabled: z.boolean(), settlementsEnabled: z.boolean(), maintenanceMode: z.boolean() }).strict(),
  payments: z.object({ bkash: methodSchema, nagad: methodSchema }).strict(),
  promotion: z.object({ enabled: z.boolean(), amountMinor: positiveMinor, campaign: z.string().min(3).max(40) }).strict(),
  referral: z.object({ enabled: z.boolean(), commissionMinor: positiveMinor, thresholdMinor: positiveMinor }).strict(),
  withdrawal: z.object({ minMinor: positiveMinor, maxMinor: positiveMinor, feeMinor: minor }).strict().refine((v) => BigInt(v.minMinor) <= BigInt(v.maxMinor), 'Minimum must not exceed maximum.'),
  content: z.object({ terms: z.string().max(20000).optional(), privacy: z.string().max(20000).optional(), risk: z.string().max(20000).optional(), refund: z.string().max(20000).optional(), faq: z.string().max(20000).optional(), revenueModel: z.string().max(20000).optional(), reviewed: z.boolean() }).strict(),
};
adminRouter.patch('/settings', async (req, res) => {
  const input = z.object({ key: z.enum(['platform', 'payments', 'promotion', 'referral', 'withdrawal', 'content']), value: z.unknown(), reason }).strict().parse(req.body);
  const value = settingsSchemas[input.key].parse(input.value);
  const record = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(817362910)`;
    const previous = await tx.siteSetting.findUnique({ where: { key: input.key } });
    const record = await tx.siteSetting.upsert({ where: { key: input.key }, create: { key: input.key, value, updatedById: req.user!.id }, update: { value, updatedById: req.user!.id } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'SETTING_UPDATED', targetType: 'SiteSetting', targetId: input.key, metadata: { reason: input.reason, before: previous?.value ?? null, after: value } } });
    return record;
  });
  res.json({ data: record });
});
adminRouter.post('/risk/:id/review', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), reason }).strict().parse(req.body);
  const record = await prisma.$transaction(async (tx) => {
    const record = await tx.riskFlag.update({ where: { id }, data: { status: input.status, reviewNote: input.reason, reviewedBy: req.user!.id } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'RISK_REVIEWED', targetType: 'RiskFlag', targetId: id, metadata: input } });
    return record;
  });
  res.json({ data: record });
});

adminRouter.post('/reconciliation', async (req,res)=>{
 const record=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(817362910)`;
  const accounts=await tx.walletAccount.findMany();
  const totals=await tx.walletLedger.groupBy({by:['accountId'],_sum:{amountMinor:true}});
  const mismatches=accounts.filter(a=>a.balanceMinor!==(totals.find(t=>t.accountId===a.id)?._sum.amountMinor??0n)||a.balanceMinor<0n).map(a=>a.id);
  const reserved=accounts.filter(a=>a.kind==='RESERVED').reduce((sum,a)=>sum+a.balanceMinor,0n);
  const held=await tx.walletReservation.aggregate({where:{status:'HELD'},_sum:{amountMinor:true}});
  const reserveRows=await tx.payoutReserve.findMany({include:{allocations:true,commissions:true,promotions:true}});
  const reserveMismatches=reserveRows.filter(r=>r.fundedMinor-r.availableMinor!==[...r.allocations,...r.commissions,...r.promotions].reduce((sum,v)=>sum+v.amountMinor,0n)).map(r=>r.id);
  const findings={ledgerCacheMismatches:mismatches,reserveMismatches,heldReservationsMinor:String(held._sum.amountMinor??0n),reservedLedgerMinor:String(reserved),reservationsMatch:reserved===(held._sum.amountMinor??0n),note:'Internal check only; independently reconcile bank/provider custody and settlement records.'};
  const record=await tx.reconciliationRun.create({data:{status:mismatches.length||reserveMismatches.length||!findings.reservationsMatch?'REVIEW_REQUIRED':'INTERNAL_CHECK_PASSED',findings,createdById:req.user!.id}});
  await tx.auditLog.create({data:{actorId:req.user!.id,action:'RECONCILIATION_RUN',targetType:'ReconciliationRun',targetId:record.id,metadata:findings}});return record;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 res.json({data:record});
});

// Fixed allowlist, never a client-selected arbitrary Prisma model/query. User data uses an explicit password-free selection.
const delegates = {
  users: prisma.user, verifications: prisma.verifiedContact, plans: prisma.machinePlan, contracts: prisma.machineContract,
  operations: prisma.miningOperation, revenues: prisma.miningRevenue, deposits: prisma.depositRequest, withdrawals: prisma.withdrawalRequest,
  referrals: prisma.referralRelationship, ledger: prisma.walletLedger, reconciliation: prisma.reconciliationRun,
  notifications: prisma.notification, content: prisma.siteSetting, announcements: prisma.announcement, support: prisma.supportTicket,
  risk: prisma.riskFlag, audit: prisma.auditLog, settings: prisma.siteSetting, security: prisma.securityEvent, reserves: prisma.payoutReserve,
} as const;
adminRouter.get('/:resource', async (req, res) => {
  const resource = String(req.params.resource);
  const { page, pageSize, skip, take } = pagination(req.query);
  if (resource === 'backups') return res.json({ data: { items: [{ id: 'infrastructure', status: config.DURABLE_INFRASTRUCTURE_CONFIRMED ? 'OPERATOR_ATTESTED' : 'NOT_VERIFIED', automatedBackupsVerified: false, restoreDrillVerified: false, emailConfigured, captchaConfigured: Boolean(config.TURNSTILE_SECRET_KEY), mfaConfigured: false, notes: 'Render backup and restore status must be independently checked. Free PostgreSQL expires after 30 days; no managed backup. Free services sleep.' }], total: 1, page: 1, pageSize } });
  if (!(resource in delegates)) throw new AppError(404, 'NOT_FOUND', 'Administrative resource not found.');
  const delegate = delegates[resource as keyof typeof delegates] as unknown as { findMany: (args: Record<string, unknown>) => Promise<unknown[]>; count: (args: Record<string, unknown>) => Promise<number> };
  const search = z.string().max(100).catch('').parse(req.query.search);
  const where = resource === 'users' && search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { fullName: { contains: search, mode: 'insensitive' } }] }
    : resource === 'content' ? { key: 'content' } : {};
  const orderBy = ['plans', 'settings', 'content'].includes(resource) ? { updatedAt: 'desc' } : resource === 'verifications' ? { verifiedAt: 'desc' } : { createdAt: 'desc' };
  const [items, total] = await Promise.all([delegate.findMany({ where, skip, take, orderBy, ...(resource === 'users' ? { select: userSelect } : {}) }), delegate.count({ where })]);
  res.json({ data: { items, total, page, pageSize } });
});
