import {randomBytes} from 'node:crypto';
// Run privately. Paste each output ONLY into your local .env or Render secret fields.
console.log(`SESSION_SECRET=${randomBytes(32).toString('hex')}`);
console.log(`IP_HASH_SECRET=${randomBytes(32).toString('hex')}`);
