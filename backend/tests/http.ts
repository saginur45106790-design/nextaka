import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/crypto.js';
export const origin='http://localhost:5173';
export const password='Integration-Only-Strong-1234';
export async function session(role='USER'){
 const user=await prisma.user.create({data:{email:`${randomUUID()}@example.test`,fullName:'Integration Test',passwordHash:await hashPassword(password),role,referralCode:randomUUID(),emailVerifiedAt:new Date(),termsAcceptedAt:new Date()}});
 const agent=request.agent(app);const csrf=await agent.get('/api/auth/csrf');
 const login=await agent.post('/api/auth/login').set('Origin',origin).set('X-CSRF-Token',csrf.body.data.csrfToken).send({email:user.email,password,turnstileToken:'test-only'});
 if(login.status!==200)throw new Error(`Fixture login failed: ${login.status}`);
 return {user,agent,csrf:csrf.body.data.csrfToken as string};
}
