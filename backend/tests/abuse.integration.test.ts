import { afterAll,describe,expect,it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { prisma } from '../src/db.js';
import { app } from '../src/app.js';
import { consumeRateLimit } from '../src/security.js';
import { origin,password } from './http.js';
describe('persistent anti-abuse controls',()=>{
 afterAll(()=>prisma.$disconnect());
 it('atomically enforces a shared persistent rate limit',async()=>{
  const k=`test-${randomUUID()}`;const results=await Promise.allSettled(Array.from({length:5},()=>consumeRateLimit(k,2,60000)));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(2);
  expect((await prisma.rateLimit.findUniqueOrThrow({where:{key:k}})).count).toBe(5);
 });
 it('records shared registration risk without blanket banning a household',async()=>{
  await prisma.rateLimit.deleteMany();
  const agent=request.agent(app);const c=await agent.get('/api/auth/csrf');
  for(let i=0;i<3;i++){
   const email=`${randomUUID()}@example.test`;const r=await agent.post('/api/auth/register').set('Origin',origin).set('X-CSRF-Token',c.body.data.csrfToken).send({fullName:'Shared Network',email,phone:'01712345679',password,confirmPassword:password,termsAccepted:true,turnstileToken:'test-only'});
   expect(r.status).toBe(201);expect(r.body.data.user.status).toBe('ACTIVE');
   if(i===2)expect(await prisma.riskFlag.count({where:{userId:r.body.data.user.id,type:'SHARED_REGISTRATION_IP'}})).toBeGreaterThan(0);
  }
 });
});
