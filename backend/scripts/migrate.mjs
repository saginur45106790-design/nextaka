import 'dotenv/config';
import { spawnSync } from 'node:child_process';
const connection=process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL;
if(!connection){console.error('Missing migration connection. Configure it privately.');process.exit(1);}
const result=spawnSync('npx',['prisma','migrate','deploy'],{env:{...process.env,DATABASE_URL:connection},stdio:'inherit',shell:false});
if(result.error){console.error('Migration command could not be started.');process.exit(1);}
process.exit(result.status??1);
