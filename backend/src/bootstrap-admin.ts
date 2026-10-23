import { prisma } from './db.js';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

// This CLI requires trusted database access, never an internet-facing bootstrap endpoint.
const emailIndex = process.argv.indexOf('--email');
const email = process.argv[emailIndex + 1]?.trim().toLowerCase();
if (emailIndex < 0 || !email || !email.includes('@')) throw new Error('Usage: npm run admin:create -- --email verified-owner@example.com');
try {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(701926403)`;
    const user = await tx.user.findUnique({ where: { email } });
    if (!user || !user.emailVerifiedAt || user.status !== 'ACTIVE') throw new Error('Register and verify this email through the application before assigning administrator access.');
    if (user.role === 'ADMIN') return 'Account already has administrator access.';
    await tx.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({ data: { actorId: user.id, action: 'ADMIN_BOOTSTRAPPED', targetType: 'User', targetId: user.id, metadata: { method: 'trusted_database_cli', operationId: randomUUID(), environment: config.NODE_ENV } } });
    return 'Administrator assigned. All prior sessions revoked. Sign in again. Record this trusted operator action in your access register.';
  });
  process.stdout.write(`${result}\n`);
} finally { await prisma.$disconnect(); }
