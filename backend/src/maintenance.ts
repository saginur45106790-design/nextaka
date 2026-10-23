import { prisma } from './db.js';
// Only ephemeral authentication data is cleaned. Financial and audit records are never deleted.
async function main(){const now=new Date();const [sessions,tokens,limits]=await prisma.$transaction([
 prisma.session.deleteMany({where:{expiresAt:{lt:now}}}),
 prisma.authToken.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-7*86400000)}}}),
 prisma.rateLimit.deleteMany({where:{expiresAt:{lt:now}}})
]);console.info(JSON.stringify({task:'maintenance',sessions:sessions.count,tokens:tokens.count,limits:limits.count}));}
main().catch(()=>{console.error('Maintenance failed; inspect database availability.');process.exitCode=1;}).finally(()=>prisma.$disconnect());
