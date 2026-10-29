import { once } from 'node:events';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { loadConfig } from '../src/config.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const night = '2026-10-28';
const args = process.argv.slice(2);
const mode = args[0];

class PreviewError extends Error {}

if (args.length !== 1 || (mode !== '--marked' && mode !== '--clean')) {
  console.error('Usage: pnpm preview:export --marked | --clean');
  process.exitCode = 1;
} else {
  try {
    await exportPreview(mode);
  } catch (error) {
    // Never print server errors, environment values or response HTML: any may carry the marker.
    console.error(error instanceof PreviewError
      ? `Preview export failed: ${error.message}`
      : 'Preview export failed. Check config, the sample digest route and local socket permissions.');
    process.exitCode = 1;
  }
}

async function exportPreview(mode: '--marked' | '--clean'): Promise<void> {
  const folder = resolve(root, '.preview', mode.slice(2));
  const output = resolve(folder, 'index.html');
  const pending = resolve(folder, 'index.html.tmp');
  // A failed attempt must not leave an older file looking like its new result.
  await mkdir(folder, { recursive: true });
  await rm(output, { force: true });
  await rm(pending, { force: true });

  const previousMarker = process.env.LANE_MARKER?.trim() || null;
  if (mode === '--marked' && previousMarker === null) {
    throw new PreviewError('Marked mode requires LANE_MARKER in the environment.');
  }
  if (mode === '--clean') delete process.env.LANE_MARKER;

  // No dotenv or --env-file here. In clean mode, clear before importing/rendering the app.
  const { createApp } = await import('../src/app.js');
  const config = { ...loadConfig(resolve(root, 'rig.json')), runsDir: resolve(root, 'runs') };
  const server = serve({ fetch: createApp(config).fetch, hostname: '127.0.0.1', port: 0 });
  let html: string;
  try {
    await once(server, 'listening');
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/digest/${night}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { Connection: 'close' },
    });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) {
      throw new PreviewError('Expected an HTML digest with HTTP 200.');
    }
    html = await response.text();
  } finally {
    await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
  }

  const marker = html.match(/<span class="marker">([^<]*)<\/span>/)?.[1];
  const expected = mode === '--marked' ? escapeHtml(previousMarker!) : 'no marker set';
  if (marker !== expected || !html.startsWith('<!doctype html>') || !html.includes(`digest · ${night}`)) {
    throw new PreviewError('Expected the rendered digest and lane banner.');
  }
  if (mode === '--clean' && previousMarker !== null &&
      (html.includes(previousMarker) || html.includes(escapeHtml(previousMarker)))) {
    throw new PreviewError('The old marker must be absent from the entire clean response.');
  }
  if (/<(?:script|link|img|iframe|object|embed)\b|\son\w+\s*=|@import\b|url\s*\(/i.test(html)) {
    throw new PreviewError('The preview must be self-contained, without client scripts or external assets.');
  }

  // Save the HTTP response unchanged; do not rebuild or substitute any HTML.
  await writeFile(pending, html, { encoding: 'utf8', mode: 0o600 });
  await rename(pending, output);
  console.log(`Exported /digest/${night} to .preview/${mode.slice(2)}/index.html`);
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}
