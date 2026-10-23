import { randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { hash, verify, argon2id } from 'argon2';
export const randomToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const hmacHash = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('hex');
export function constantTimeEqual(a: string, b: string): boolean {
 const left = Buffer.from(a), right = Buffer.from(b);
 return left.length === right.length && timingSafeEqual(left, right);
}
export async function hashPassword(password: string): Promise<string> {
 return hash(password, {type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1});
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
 if (!stored.startsWith('$argon2id$')) return false;
 try { return await verify(stored, password); } catch { return false; }
}
