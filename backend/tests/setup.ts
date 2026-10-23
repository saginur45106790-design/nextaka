// Executed before application imports. Production databases are never accepted.
import { execFileSync } from 'node:child_process';
const raw=process.env.TEST_DATABASE_URL;
if(!raw)throw new Error('TEST_DATABASE_URL is required for integration tests.');
const url=new URL(raw);
if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/nextaka_test(?:_[a-z0-9]+)?$/.test(url.pathname))throw new Error('Only a local disposable nextaka_test database is permitted.');
process.env.DATABASE_URL=raw;
process.env.NODE_ENV='test';
process.env.SESSION_SECRET='automated-test-only-session-secret-not-production';
process.env.IP_HASH_SECRET='automated-test-only-ip-hash-secret-not-production';
process.env.FRONTEND_URL='http://localhost:5173';
process.env.AUTH_TEST_BYPASS='true';
process.env.TRUST_PROXY_HOPS='0';
for(const flag of ['FINANCIAL_ACTIVITY_ENABLED','DURABLE_INFRASTRUCTURE_CONFIRMED','COMPLIANCE_APPROVED','PAYMENT_OPERATIONS_READY','BACKUPS_RESTORE_TESTED','SECURITY_REVIEW_APPROVED'])process.env[flag]='false';
execFileSync('npx',['prisma','migrate','deploy'],{cwd:process.cwd(),env:process.env,stdio:'pipe'});
