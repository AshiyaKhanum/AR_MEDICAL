import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

async function main() {
  await prisma.$connect();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`AR Medical API listening on port ${env.port} [${env.nodeEnv}]`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
