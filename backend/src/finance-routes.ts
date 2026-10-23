import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, rateLimit } from './security.js';
import { verifyPassword } from './crypto.js';
import { AppError } from './errors.js';
import * as finance from './finance.js';

export const financeRouter = Router();
const amount = z.string().regex(/^[0-9]{1,13}$/);
const uuid = z.string().uuid();
const text = z.string().trim().min(3).max(500);
const evidence = z.string().trim().min(20).max(4000);
const reason = z.string().trim().min(10).max(2000);
const provider = z.enum(['BKASH', 'NAGAD']);
const isoDate = z.string().datetime({ offset: true });
const key = (req: Request) => req.get('Idempotency-Key') ?? '';
const actor = (req: Request) => req.user!.id;
const param = (req: Request) => uuid.parse(req.params.id);

financeRouter.post('/contracts/purchase', requireAuth, async (req, res) => {
  res.status(201).json({ data: await finance.purchase(actor(req), key(req), z.object({ planId: z.string().min(1).max(100) }).strict().parse(req.body)) });
});
financeRouter.post('/deposits', requireAuth, async (req, res) => {
  const input = z.object({ provider, amountMinor: amount, reference: text, senderAccount: z.string().trim().regex(/^\+?[0-9]{10,15}$/) }).strict().parse(req.body);
  res.status(201).json({ data: await finance.requestDeposit(actor(req), key(req), input) });
});
financeRouter.post('/withdrawals', requireAuth, rateLimit('withdrawal-confirm',5,900000), async (req, res) => {
  const { password, ...input } = z.object({ provider, amountMinor: amount, recipientAccount: z.string().trim().regex(/^\+?[0-9]{10,15}$/), recipientName: text, password: z.string().min(1).max(256) }).strict().parse(req.body);
  if (!await verifyPassword(password, req.user!.passwordHash)) throw new AppError(403, 'SECURITY_CONFIRMATION_FAILED', 'Password confirmation failed.');
  res.status(201).json({ data: await finance.requestWithdrawal(actor(req), key(req), input) });
});
financeRouter.post('/withdrawals/:id/cancel', requireAuth, async (req, res) => {
  res.json({ data: await finance.cancelWithdrawal(actor(req), key(req), param(req)) });
});
financeRouter.post('/admin/operations', requireAdmin, async (req, res) => {
  res.status(201).json({ data: await finance.createOperation(actor(req), key(req), z.object({ reference: text, providerReference: text, description: z.string().trim().min(20).max(4000), arrangementEvidence: evidence }).strict().parse(req.body)) });
});
financeRouter.post('/admin/operations/:id/verify', requireAdmin, async (req, res) => {
  res.json({ data: await finance.verifyOperation(actor(req), key(req), param(req), z.object({ evidence }).strict().parse(req.body)) });
});
financeRouter.post('/admin/reserves', requireAdmin, async (req, res) => {
  res.status(201).json({ data: await finance.createReserve(actor(req), key(req), z.object({ purpose: z.enum(['MINING', 'REFERRAL', 'PROMOTION']), sourceType: z.enum(['MINING_PROCEEDS', 'OWNER_CAPITAL', 'EARNED_FEES']), sourceReference: text, evidence, amountMinor: amount }).strict().parse(req.body)) });
});
financeRouter.post('/admin/reserves/:id/verify', requireAdmin, async (req, res) => {
  res.json({ data: await finance.verifyReserve(actor(req), key(req), param(req), z.object({ evidence }).strict().parse(req.body)) });
});
financeRouter.post('/admin/revenues', requireAdmin, async (req, res) => {
  res.status(201).json({ data: await finance.createRevenue(actor(req), key(req), z.object({ operationId: uuid, reference: text, grossMinor: amount, operatingCostMinor: amount, periodStartsAt: isoDate, periodEndsAt: isoDate, evidence }).strict().parse(req.body)) });
});
financeRouter.post('/admin/revenues/:id/verify', requireAdmin, async (req, res) => {
  res.json({ data: await finance.verifyRevenue(actor(req), key(req), param(req), z.object({ evidence, statementReference: text }).strict().parse(req.body)) });
});
financeRouter.post('/admin/allocations', requireAdmin, async (req, res) => {
  res.status(201).json({ data: await finance.allocateReward(actor(req), key(req), z.object({ contractId: uuid, revenueId: uuid, reserveId: uuid, period: z.number().int().min(1).max(366), amountMinor: amount }).strict().parse(req.body)) });
});
financeRouter.post('/admin/deposits/:id/verify', requireAdmin, async (req, res) => {
  res.json({ data: await finance.verifyDeposit(actor(req), key(req), param(req), z.object({ settlementReference: text, amountMinor: amount, evidence, providerConfirmedAt: isoDate }).strict().parse(req.body)) });
});
financeRouter.post('/admin/deposits/:id/review', requireAdmin, async (req, res) => {
  res.json({ data: await finance.reviewDeposit(actor(req), key(req), param(req), z.object({ action: z.enum(['APPROVE', 'REJECT', 'REVIEW']), reason }).strict().parse(req.body)) });
});
financeRouter.post('/admin/withdrawals/:id/review', requireAdmin, async (req, res) => {
  res.json({ data: await finance.reviewWithdrawal(actor(req), key(req), param(req), z.object({ action: z.enum(['REVIEW', 'APPROVE', 'PROCESS', 'PAID', 'REJECT']), reason, settlementReference: text.optional(), evidence: evidence.optional(), settledAt: isoDate.optional() }).strict().parse(req.body)) });
});
financeRouter.post('/admin/referrals/:id/review', requireAdmin, async (req, res) => {
  const input = z.object({ action: z.enum(['APPROVE', 'REJECT']), reason, reserveId: uuid.optional(), qualifyingDepositId: uuid.optional() }).strict().refine(v => v.action !== 'APPROVE' || (v.reserveId && v.qualifyingDepositId), { message: 'Approval requires an independently funded reserve and a qualifying deposit.' }).parse(req.body);
  res.json({ data: await finance.reviewReferral(actor(req), key(req), param(req), input) });
});
financeRouter.post('/admin/promotions/:id', requireAdmin, async (req, res) => {
  res.status(201).json({ data: await finance.awardPromotion(actor(req), key(req), param(req), z.object({ reserveId: uuid, reason }).strict().parse(req.body)) });
});
financeRouter.post('/admin/settlements/run', requireAdmin, async (req, res) => {
  z.object({}).strict().parse(req.body);
  res.json({ data: await finance.settleRewards(actor(req)) });
});

financeRouter.post('/admin/contracts/:id/review',requireAdmin,async(req,res)=>{
 const input=z.object({action:z.enum(['PAUSE','RESUME','REFUND']),reason}).strict().parse(req.body);
 res.json({data:await finance.reviewContract(actor(req),key(req),param(req),input)});
});
financeRouter.post('/deposits/:id/cancel',requireAuth,async(req,res)=>{
 res.json({data:await finance.cancelDeposit(actor(req),key(req),param(req))});
});
