import { afterAll,describe,expect,it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';
import { session,origin } from './http.js';
describe('authorization, CSRF and tenant boundaries',()=>{
 afterAll(()=>prisma.$disconnect());
 it('rejects anonymous admin and dashboard access',async()=>{
  expect((await request(app).get('/api/admin/overview')).status).toBe(401);
  expect((await request(app).get('/api/dashboard')).status).toBe(401);
 });
 it('rejects user administration and ignores forged user IDs',async()=>{
  const a=await session(),b=await session();
  await prisma.notification.create({data:{userId:b.user.id,title:'Private',message:'Never visible to other user'}});
  expect((await a.agent.get('/api/admin/users')).status).toBe(403);
  const notices=await a.agent.get(`/api/notifications?userId=${b.user.id}`);expect(notices.status).toBe(200);expect(notices.body.data).toHaveLength(0);
  const foreign=await prisma.notification.findFirstOrThrow({where:{userId:b.user.id}});
  const changed=await a.agent.post(`/api/notifications/${foreign.id}/read`).set('Origin',origin).set('X-CSRF-Token',a.csrf).send({});expect(changed.status).toBe(404);
 });
 it('rejects missing CSRF and hostile origins before mutations',async()=>{
  const a=await session();
  expect((await a.agent.post('/api/auth/logout').set('Origin',origin).send({})).status).toBe(403);
  expect((await a.agent.post('/api/auth/logout').set('Origin','https://attacker.invalid').set('X-CSRF-Token',a.csrf).send({})).status).toBe(403);
 });
 it('sanitizes real admin data and revokes suspended accounts',async()=>{
  const a=await session('ADMIN'),u=await session();
  const result=await a.agent.get('/api/admin/users');expect(result.status).toBe(200);expect(result.body.data.items.every((r:Record<string,unknown>)=>!('passwordHash' in r))).toBe(true);
  const changed=await a.agent.post(`/api/admin/users/${u.user.id}/status`).set('Origin',origin).set('X-CSRF-Token',a.csrf).send({status:'SUSPENDED',reason:'Automated authorization test'});expect(changed.status).toBe(200);
  expect((await u.agent.get('/api/dashboard')).status).toBe(401);
 });
});
