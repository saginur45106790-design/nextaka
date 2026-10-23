import { randomUUID } from 'node:crypto';
import { afterAll,describe,expect,it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';
import { tokenHash,randomToken } from '../src/crypto.js';
import { origin,password } from './http.js';
describe('database authentication',()=>{
 afterAll(()=>prisma.$disconnect());
 it('registers hashed accounts, logs in, verifies email exactly once and resets sessions',async()=>{
  const agent=request.agent(app);const c=await agent.get('/api/auth/csrf');const csrf=c.body.data.csrfToken;
  const email=`${randomUUID()}@example.test`;const body={fullName:'Test Person',email,phone:'01712345678',password,confirmPassword:password,termsAccepted:true,turnstileToken:'test-only'};
  const register=await agent.post('/api/auth/register').set('Origin',origin).set('X-CSRF-Token',csrf).send(body);
  expect(register.status).toBe(201);expect(register.body.data.user.passwordHash).toBeUndefined();
  const user=await prisma.user.findUniqueOrThrow({where:{email}});expect(user.passwordHash).toMatch(/^\$argon2id\$/);expect(user.emailVerifiedAt).toBeNull();
  const duplicate=await agent.post('/api/auth/register').set('Origin',origin).set('X-CSRF-Token',csrf).send(body);expect(duplicate.status).toBe(409);
  const login=await agent.post('/api/auth/login').set('Origin',origin).set('X-CSRF-Token',csrf).send({email,password,turnstileToken:'test-only'});expect(login.status).toBe(200);
  expect((await agent.get('/api/auth/me')).status).toBe(200);
  const verifyToken=randomToken();await prisma.authToken.create({data:{userId:user.id,kind:'VERIFY_EMAIL',tokenHash:tokenHash(verifyToken),expiresAt:new Date(Date.now()+60000)}});
  expect((await agent.post('/api/auth/verify-email').set('Origin',origin).set('X-CSRF-Token',csrf).send({token:verifyToken})).status).toBe(200);
  expect((await agent.post('/api/auth/verify-email').set('Origin',origin).set('X-CSRF-Token',csrf).send({token:verifyToken})).status).toBe(400);
  const reset=randomToken();await prisma.authToken.create({data:{userId:user.id,kind:'RESET_PASSWORD',tokenHash:tokenHash(reset),expiresAt:new Date(Date.now()+60000)}});
  expect((await agent.post('/api/auth/reset-password').set('Origin',origin).set('X-CSRF-Token',csrf).send({token:reset,password:'New-Integration-Password-9876'})).status).toBe(200);
  expect(await prisma.session.count({where:{userId:user.id}})).toBe(0);
  expect((await agent.get('/api/auth/me')).status).toBe(401);
 });
 it('never verifies a supplied phone through registration',async()=>{
  const users=await prisma.user.findMany({where:{phone:'+8801712345678'}});expect(users.length).toBeGreaterThan(0);expect(users.every(u=>u.phoneVerifiedAt===null)).toBe(true);
 });
});
