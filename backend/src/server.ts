import { app, logger } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
const server = app.listen(config.PORT, '0.0.0.0', () => logger.info({ port: config.PORT, mode: 'pre-launch unless all independent launch gates pass' }, 'NEXTAKA listening'));
async function shutdown() {
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
