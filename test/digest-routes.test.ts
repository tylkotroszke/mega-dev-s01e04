import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { DigestRow, NightDigest } from '../src/digest/types.js';

const night = '2026-10-28';
const sampleRunsDir = new URL('../runs/', import.meta.url);
let runsDir: string;
let config: RigConfig;

beforeEach(async () => {
  runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-routes-'));
  config = {
    adapter: 'test',
    installed: 'test',
    beatEverySeconds: 60,
    runsDir,
  };
});

afterEach(async () => {
  await rm(runsDir, { recursive: true, force: true });
});

async function writeNight(name: string, contents: string): Promise<void> {
  await writeFile(join(runsDir, `${name}.jsonl`), contents, 'utf8');
}

function event(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

function getTableRows(html: string): string[][] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  if (tbody === undefined) return [];

  return [...tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/g)].map(([, cell]) =>
      cell
        .replace(/<[^>]*>/g, '')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'"),
    ),
  );
}

function displayed(row: DigestRow): string[] {
  return [
    row.job,
    row.owner ?? '—',
    String(row.runs),
    String(row.retries),
    row.lastStatus,
    row.lastError ?? '—',
    row.firstAt,
    row.lastAt,
    row.hasFail ? 'yes' : 'no',
  ];
}

describe('digest routes through createApp', () => {
  it('serves the sample night from a temporary copy and keeps HTML and JSON in parity', async () => {
    const sample = await readFile(new URL(`${night}.jsonl`, sampleRunsDir), 'utf8');
    await writeNight(night, sample);

    const app = createApp(config);
    const [pageResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await pageResponse.text();
    const digest = (await jsonResponse.json()) as NightDigest;

    expect(pageResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(digest.night).toBe(night);
    expect(digest.rows.map(({ job }) => job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest.rows.map(displayed)).toEqual(getTableRows(html));
    expect(digest.rows).toHaveLength(5);
    expect(digest.malformedLines).toBe(1);
    expect(digest.counts).toEqual({ ok: 10, retry: 4, fail: 1 });

    const render = digest.rows[0];
    expect(render).toMatchObject({
      job: 'digest/render',
      owner: null,
      firstAt: '2026-10-29T05:41:09+01:00',
      lastAt: '2026-10-29T05:41:09+01:00',
    });
    expect(html).toContain('2026-10-29T05:41:09+01:00');
    expect(html).not.toContain('2026-10-29T04:41:09.000Z');

    const refresh = digest.rows.find(({ job }) => job === 'fixtures/refresh');
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', hasFail: false });
    const backup = digest.rows.find(({ job }) => job === 'notes/backup');
    expect(backup).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', hasFail: true });
    expect(html).toContain('class="attention"');
  });

  it('returns 404 for missing files and rejects path-like nights without reading outside runsDir', async () => {
    await writeFile(join(runsDir, 'outside.jsonl'), event({
      at: '2026-10-28T00:00:00Z', job: 'outside', status: 'ok', owner: 'test',
    }));
    const app = createApp(config);

    for (const route of ['/digest/2026-10-29', '/api/digest/2026-10-29']) {
      const response = await app.request(route);
      expect(response.status).toBe(404);
    }

    for (const route of ['/digest/%2e%2e%2Foutside', '/api/digest/%2e%2e%2Foutside']) {
      const response = await app.request(route);
      expect(response.status).toBe(404);
    }
  });

  it('returns a successful empty digest for an empty or whitespace-only file', async () => {
    await writeNight('2026-10-29', '');
    await writeNight('2026-10-30', ' \n\t\n');
    const app = createApp(config);

    for (const name of ['2026-10-29', '2026-10-30']) {
      const [pageResponse, jsonResponse] = await Promise.all([
        app.request(`/digest/${name}`),
        app.request(`/api/digest/${name}`),
      ]);
      const html = await pageResponse.text();
      const digest = await jsonResponse.json();

      expect(pageResponse.status).toBe(200);
      expect(jsonResponse.status).toBe(200);
      expect(html).toContain('nothing ran');
      expect(html).not.toContain('<table');
      expect(digest).toEqual({
        night: name,
        rows: [],
        malformedLines: 0,
        counts: { ok: 0, retry: 0, fail: 0 },
      });
    }
  });

  it('keeps valid lines when other lines are malformed, counts only valid events, and preserves offsets', async () => {
    await writeNight('2026-10-31', [
      'not JSON',
      event({ at: '2026-10-31T23:50:00-04:00', job: 'zeta', status: 'ok', owner: 'first' }),
      event({ at: '2026-10-31T23:55:00-04:00', job: 'alpha', status: 'retry', owner: null }),
      '{"at":"missing required fields"}',
      '',
    ].join('\n'));

    const app = createApp(config);
    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-31'),
      app.request('/api/digest/2026-10-31'),
    ]);
    const html = await pageResponse.text();
    const digest = await jsonResponse.json() as NightDigest;

    expect(pageResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(digest.malformedLines).toBe(2);
    expect(digest.counts).toEqual({ ok: 1, retry: 1, fail: 0 });
    expect(digest.rows.map(({ job }) => job)).toEqual(['alpha', 'zeta']);
    expect(getTableRows(html)).toEqual(digest.rows.map(displayed));
    expect(digest.rows[0].owner).toBeNull();
    expect(digest.rows[0].firstAt).toBe('2026-10-31T23:55:00-04:00');
    expect(html).toContain('2026-10-31T23:55:00-04:00');
    expect(html).not.toContain('2026-11-01T03:55:00.000Z');
  });

  it('marks three retries and a failure even when the last event succeeds', async () => {
    await writeNight('2026-11-01', [
      event({ at: '2026-11-01T00:00:00+02:00', job: 'retry/job', status: 'retry', owner: 'runner' }),
      event({ at: '2026-11-01T00:01:00+02:00', job: 'retry/job', status: 'retry', owner: 'runner' }),
      event({ at: '2026-11-01T00:02:00+02:00', job: 'retry/job', status: 'retry', owner: 'runner' }),
      event({ at: '2026-11-01T00:03:00+02:00', job: 'retry/job', status: 'ok', owner: 'runner' }),
      event({ at: '2026-11-01T00:04:00+02:00', job: 'failure/job', status: 'fail', owner: 'runner', error: '<quota & limit>' }),
      event({ at: '2026-11-01T00:05:00+02:00', job: 'failure/job', status: 'ok', owner: 'runner' }),
    ].join('\n'));

    const app = createApp(config);
    const pageResponse = await app.request('/digest/2026-11-01');
    const jsonResponse = await app.request('/api/digest/2026-11-01');
    const html = await pageResponse.text();
    const digest = await jsonResponse.json() as NightDigest;

    expect(pageResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(digest.counts).toEqual({ ok: 2, retry: 3, fail: 1 });
    expect(digest.rows).toHaveLength(2);
    expect(digest.rows[1]).toMatchObject({
      job: 'retry/job', runs: 4, retries: 3, lastStatus: 'ok', hasFail: false,
    });
    expect(digest.rows[0]).toMatchObject({
      job: 'failure/job', lastStatus: 'ok', lastError: '<quota & limit>', hasFail: true,
    });
    expect((html.match(/class="attention"/g) ?? [])).toHaveLength(2);
    expect(html).toContain('&lt;quota &amp; limit&gt;');
    expect(html).not.toContain('<quota & limit>');
  });
});
