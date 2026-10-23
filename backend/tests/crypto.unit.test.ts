import { describe,expect,it } from 'vitest';
import { hashPassword,verifyPassword,randomToken,tokenHash,constantTimeEqual } from '../src/crypto.js';
describe('credential primitives',()=>{
 it('uses salted Argon2id and rejects wrong passwords',async()=>{
  const a=await hashPassword('LongTestPassword123'),b=await hashPassword('LongTestPassword123');
  expect(a).toMatch(/^\$argon2id\$/);expect(a).not.toBe(b);
  expect(await verifyPassword('LongTestPassword123',a)).toBe(true);expect(await verifyPassword('wrong',a)).toBe(false);
 });
 it('rejects corrupt hashes without leaking parsing exceptions',async()=>expect(await verifyPassword('x','corrupt')).toBe(false));
 it('generates high-entropy opaque tokens and constant-time comparisons',()=>{
  const a=randomToken(),b=randomToken();expect(a).not.toBe(b);expect(tokenHash(a)).toHaveLength(64);
  expect(constantTimeEqual(a,a)).toBe(true);expect(constantTimeEqual(a,b)).toBe(false);expect(constantTimeEqual(a,'x')).toBe(false);
 });
});
