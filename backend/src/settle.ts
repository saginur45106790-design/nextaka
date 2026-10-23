import 'dotenv/config';
import { prisma } from './db.js';
import { financialStatus, settleRewards } from './finance.js';

async function main() {
  const status = await financialStatus();
  if (!status.financialEnabled) {
    console.info(JSON.stringify({ task: 'settlement', state: 'disabled', blockers: status.blockers }));
    return;
  }
  // Separate scheduled process; no reliance on a sleeping Render Free web service timer.
  let total = 0;
  for (let batch = 0; batch < 20; batch++) {
    const result = await settleRewards();
    total += result.settled;
    console.info(JSON.stringify({ task: 'settlement', ...result }));
    if (!result.moreMayRemain || result.settled === 0) break;
  }
  console.info(JSON.stringify({ task: 'settlement', totalSettled: total }));
}
main().catch(error => {
  console.error(JSON.stringify({ task: 'settlement', state: 'failed', code: error.code ?? 'INTERNAL_ERROR' }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
