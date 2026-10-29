import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const temporaryRunsDir = await mkdtemp(join(tmpdir(), 'rig-manual-runs-'));
const sampleNight = '2026-10-28';
const previousSampleNight = '2026-10-27';
const emptyNight = '2026-10-29';
const missingNight = '2026-10-30';

try {
  await copyFile(new URL(`../runs/${sampleNight}.jsonl`, import.meta.url), join(temporaryRunsDir, `${sampleNight}.jsonl`));
  await copyFile(new URL(`../runs/${previousSampleNight}.jsonl`, import.meta.url), join(temporaryRunsDir, `${previousSampleNight}.jsonl`));
  await writeFile(join(temporaryRunsDir, `${emptyNight}.jsonl`), '', 'utf8');

  const config: RigConfig = {
    adapter: 'manual-test',
    installed: new Date().toISOString(),
    beatEverySeconds: 60,
    runsDir: temporaryRunsDir,
  };
  const port = Number(process.env.PORT ?? 8788);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`PORT must be an integer from 0 to 65535; received ${process.env.PORT}`);
  }

  const server = serve({
    fetch: createApp(config).fetch,
    hostname: '127.0.0.1',
    port,
  }, (info) => {
    const origin = `http://127.0.0.1:${info.port}`;
    console.log(`Manual digest server bound to ${info.address}:${info.port}`);
    console.log(`Board: ${origin}/`);
    console.log(`Sample digest: ${origin}/digest/${sampleNight}`);
    console.log(`Previous sample digest: ${origin}/digest/${previousSampleNight}`);
    console.log(`Empty digest: ${origin}/digest/${emptyNight}`);
    console.log(`Missing digest: ${origin}/digest/${missingNight}`);
    console.log(`Sample JSON: ${origin}/api/digest/${sampleNight}`);
    console.log('Press Ctrl+C to stop; the temporary runs directory is removed on shutdown.');
  });

  const shutdown = () => {
    server.close(async () => {
      await rm(temporaryRunsDir, { recursive: true, force: true });
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  await rm(temporaryRunsDir, { recursive: true, force: true });
  throw error;
}
