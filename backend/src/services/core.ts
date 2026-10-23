import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;
type JsonObject = Record<string, unknown>;
const MAX_MINOR = 1_000_000_000_000n;
export function minor(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[0-9]{1,13}$/.test(value)) throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be a positive integer string in paisa.');
  const amount = BigInt(value);
  if (amount <= 0n || amount > MAX_MINOR) throw new AppError(400, 'INVALID_AMOUNT', 'Amount is outside the permitted range.');
  return amount;
}
export function nonnegativeMinor(value: unknown): bigint {
  if (value === '0') return 0n;
  return minor(value);
}
export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value, (_, v: unknown) => typeof v === 'bigint' ? v.toString() : v));
}
export async function setting<T extends JsonObject>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.siteSetting.findUnique({ where: { key } });
  return row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? { ...fallback, ...row.value } as T : fallback;
}
export async function financialStatus(db: Db = prisma) {
  const flags = [
    ['FINANCIAL_ACTIVITY_ENABLED', 'Financial activity is disabled.'],
    ['DURABLE_INFRASTRUCTURE_CONFIRMED', 'Durable production infrastructure and tested backups are not confirmed.'],
    ['BACKUPS_RESTORE_TESTED', 'Backup restoration has not been tested.'],
    ['SECURITY_REVIEW_APPROVED', 'Production security review is not approved.'],
    ['COMPLIANCE_APPROVED', 'Operational and legal launch review is not confirmed.'],
    ['PAYMENT_OPERATIONS_READY', 'Approved payment operations are not configured.'],
  ];
  const blockers = flags.filter(([name]) => process.env[name!] !== 'true').map(([, message]) => message!);
  const platform = await setting(db, 'platform', { launchApproved: false, maintenanceMode: false });
  if (platform.launchApproved !== true) blockers.push('Administrator launch approval is missing.');
  if (platform.maintenanceMode === true) blockers.push('The platform is in maintenance mode.');
  const [operations,revenues,reserves]=await Promise.all([
    db.miningOperation.count({where:{status:'VERIFIED'}}),
    db.miningRevenue.count({where:{status:'VERIFIED',operation:{status:'VERIFIED'},netMinor:{gt:0n}}}),
    db.payoutReserve.count({where:{purpose:'MINING',status:'VERIFIED',fundedMinor:{gt:0n}}})
  ]);
  if(!operations)blockers.push('A real mining operating arrangement has not been verified.');
  if(!revenues)blockers.push('Actual net mining revenue has not been verified.');
  if(!reserves)blockers.push('Independent mining payout funding has not been verified.');
  return { mode: blockers.length ? 'PRELAUNCH' : 'LIVE', financialEnabled: blockers.length === 0, blockers };
}
export async function gate(tx: Tx, activity: string) {
  const status = await financialStatus(tx);
  if (!status.financialEnabled) throw new AppError(423, 'PRELAUNCH', 'Real-money activity is disabled until infrastructure, funding, payment and legal reviews are complete.');
  const platform = await setting(tx, 'platform', {});
  const operations = await tx.miningOperation.count({ where: {status: 'VERIFIED'} });
  const revenue = await tx.miningRevenue.count({ where: {status: 'VERIFIED', operation: {status: 'VERIFIED'}} });
  const reserve = await tx.payoutReserve.count({ where: {status: 'VERIFIED', purpose: 'MINING', availableMinor: {gt: 0n}} });
  if (!operations || !revenue || (['purchases','deposits'].includes(activity) && !reserve)) throw new AppError(423, 'MINING_NOT_READY', 'Verified mining operations, actual revenue and a funded reserve are required.');
  if (platform[`${activity}Enabled`] !== true) throw new AppError(423, 'ACTIVITY_PAUSED', `${activity} are paused by the operator.`);
}
export async function eligibleUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE' || !user.emailVerifiedAt) throw new AppError(403, 'ACCOUNT_INELIGIBLE', 'An active, verified account is required.');
  if (await tx.riskFlag.count({ where: { userId, status: 'OPEN' } })) throw new AppError(423, 'RISK_REVIEW', 'This account requires risk review before financial activity.');
  return user;
}
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${stable((value as JsonObject)[k])}`).join(',')}}`;
}
/** Transactions globally serialize financial posting. Wallet rows are also locked by the ledger trigger.
 * This conservative policy favors correctness over throughput; replace with ordered fine-grained locks only after load tests. */
export async function financialTransaction<T>(actorId: string, key: string, operation: string, input: unknown, work: (tx: Tx) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new AppError(400, 'IDEMPOTENCY_REQUIRED', 'A UUID Idempotency-Key is required.');
  const requestHash = createHash('sha256').update(stable({ operation, input })).digest('hex');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(817362910)`;
        const old = await tx.idempotencyKey.findUnique({ where: { actorId_key: { actorId, key } } });
        if (old) {
          if (old.operation !== operation || old.requestHash !== requestHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for different data.');
          return old.response as T;
        }
        const result = await work(tx);
        await tx.idempotencyKey.create({ data: { actorId, key, operation, requestHash, response: json(result) } });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 20_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'ALREADY_EXISTS', 'This financial event or provider reference has already been recorded.');
      throw error;
    }
  }
  throw new AppError(503, 'BUSY', 'Please retry this request with the same idempotency key.');
}
export async function audit(tx: Tx, actorId: string | null, action: string, targetType: string, targetId: string, metadata: unknown = {}) {
  await tx.auditLog.create({ data: { actorId, action, targetType, targetId, metadata: json(metadata) } });
}
export async function ensureWallets(tx: Tx, userId: string) {
  for (const kind of ['MAIN', 'WITHDRAWAL', 'PROMOTIONAL', 'RESERVED']) await tx.walletAccount.upsert({ where: { userId_kind: { userId, kind } }, create: { userId, kind }, update: {} });
}
export async function post(tx: Tx, userId: string, accountKind: string, amountMinor: bigint, kind: string, referenceId: string, eventKey: string, actorId: string | null, description: string) {
  await ensureWallets(tx, userId);
  const account = await tx.walletAccount.findUniqueOrThrow({ where: { userId_kind: { userId, kind: accountKind } } });
  // balanceMinor is maintained exclusively by the immutable ledger's PostgreSQL trigger.
  await tx.$queryRaw`SELECT id FROM "WalletAccount" WHERE id = ${account.id}::uuid FOR UPDATE`;
  const sum = await tx.walletLedger.aggregate({ where: { accountId: account.id }, _sum: { amountMinor: true } });
  if ((sum._sum.amountMinor ?? 0n) + amountMinor < 0n) throw new AppError(409, 'INSUFFICIENT_BALANCE', 'The available wallet balance is insufficient.');
  return tx.walletLedger.create({ data: { accountId: account.id, amountMinor, eventKey, kind, referenceId, actorId, description } });
}
export async function paymentReady(tx: Tx, provider: string) {
  if (!['BKASH', 'NAGAD'].includes(provider)) throw new AppError(400, 'INVALID_PROVIDER', 'Unsupported payment provider.');
  const payments = await setting(tx, 'payments', {});
  const method = payments[provider.toLowerCase()] as JsonObject | undefined;
  if (method?.enabled !== true || !method.merchantAccount || !method.instructions) throw new AppError(423, 'PROVIDER_NOT_CONFIGURED', 'This payment method is not configured.');
}
export async function fundedReserve(tx: Tx, reserveId: string, purpose: string, amount: bigint) {
  await tx.$queryRaw`SELECT id FROM "PayoutReserve" WHERE id=${reserveId}::uuid FOR UPDATE`;
  const reserve = await tx.payoutReserve.findUnique({ where: { id: reserveId } });
  if (!reserve || reserve.status !== 'VERIFIED' || reserve.purpose !== purpose || !reserve.verifiedAt || !reserve.verifiedById) throw new AppError(409, 'UNVERIFIED_RESERVE', 'A verified, independently funded reserve of the correct purpose is required.');
  if (reserve.availableMinor < amount) throw new AppError(409, 'INSUFFICIENT_RESERVE', 'The funding reserve is insufficient.');
  await tx.payoutReserve.update({ where: { id: reserveId }, data: { availableMinor: { decrement: amount } } });
  return reserve;
}

export {prisma,Prisma,AppError};
