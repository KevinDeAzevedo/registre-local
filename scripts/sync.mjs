import nextEnv from '@next/env';
import { synchronize } from '../lib/sync.ts';

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === 'development');
try {
  const count = await synchronize();
  console.log(`Synchronisation réussie · ${count} fiches`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
