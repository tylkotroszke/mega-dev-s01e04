import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readNight } from '../src/digest/reader.js';

vi.mock('node:fs', async importOriginal => {
  const original = await importOriginal<typeof fs>();
  return { ...original, readFileSync: vi.fn(original.readFileSync) };
});

const night = '2026-10-28';
const tempDirs: string[] = [];

function fixture(lines: unknown[], selectedNight = night): string {
  const dir = fs.mkdtempSync(join(tmpdir(), 'rig-reader-'));
  tempDirs.push(dir);
  fs.writeFileSync(join(dir, `${selectedNight}.jsonl`), lines.map(line =>
    typeof line === 'string' ? line : JSON.stringify(line)).join('\n'));
  return dir;
}

const event = (overrides: Record<string, unknown> = {}) => ({
  at: '2026-10-29T01:00:00+01:00', job: 'job', status: 'ok', owner: 'rook', ...overrides,
});

afterEach(() => {
  vi.mocked(fs.readFileSync).mockReset();
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('aggregates the original sample and leaves both fixtures byte-identical', () => {
    const filenames = ['2026-10-27.jsonl', '2026-10-28.jsonl'];
    const before = filenames.map(name => fs.readFileSync(join('runs', name)));
    expect(readNight('runs', night)).toEqual({
      night, malformedLines: 1, counts: { ok: 10, retry: 4, fail: 1 },
      rows: [
        { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00', hasFail: false },
        { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00', hasFail: false },
        { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00', hasFail: false },
        { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00', hasFail: true },
        { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00', hasFail: false },
      ],
    });
    expect(readNight('runs', '2026-10-27')?.counts).toEqual({ ok: 7, retry: 0, fail: 0 });
    expect(filenames.map(name => fs.readFileSync(join('runs', name)))).toEqual(before);
  });

  it.each(['', ' \t\r\n\n '])('distinguishes existing empty input from missing files (%j)', source => {
    const dir = fixture([source]);
    expect(readNight(dir, night)).toEqual({ night, rows: [], malformedLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    expect(readNight(dir, '2026-10-27')).toBeNull();
    expect(readNight(join(dir, 'missing'), night)).toBeNull();
  });

  it('counts invalid records once each, ignores blank lines and continues to valid events', () => {
    const bad = [
      '{', 'null', '[]', '3', '"text"', '{}',
      event({ job: '' }), event({ job: 4 }), event({ status: 'pending' }),
      event({ owner: undefined }), event({ owner: 4 }), event({ error: null }), event({ error: 4 }),
      event({ at: null }), event({ at: '2026-02-29T01:00:00Z' }),
      event({ at: '2026-04-31T01:00:00Z' }), event({ at: '2026-10-29T25:00:00Z' }),
      event({ at: '2026-10-29T01:60:00Z' }), event({ at: '2026-10-29T01:00:60Z' }),
      event({ at: '2026-10-29T01:00:00+24:00' }), event({ at: '2026-10-29T01:00:00+01:60' }),
      event({ at: '2026-10-29T01:00:00' }), event({ at: 'October 29, 2026' }),
      event({ at: ' 2026-10-29T01:00:00Z' }),
      event({ at: '2026-10-29T01:00:00Z\n' }),
    ];
    const dir = fixture([event({ status: 'retry' }), '', ...bad, ' \t\r', event({ owner: null, extra: true })]);
    const result = readNight(dir, night);
    expect(result?.malformedLines).toBe(bad.length);
    expect(result?.counts).toEqual({ ok: 1, retry: 1, fail: 0 });
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows[0]).toMatchObject({ runs: 2, retries: 1, owner: null });
    expect(readNight(fixture(bad), night)).toEqual({
      night, rows: [], malformedLines: bad.length, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('orders shuffled events by instant, retaining offsets, latest owner, error and any failure', () => {
    const dir = fixture([
      event({ at: '2026-10-29T01:00:00-02:00', owner: null }),
      event({ at: '2026-10-29T03:00:00+02:00', status: 'fail', error: 'earlier error' }),
      event({ at: '2026-10-29T02:00:00Z', status: 'retry', error: 'latest error' }),
    ]);
    expect(readNight(dir, night)?.rows).toEqual([{
      job: 'job', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: 'latest error',
      firstAt: '2026-10-29T03:00:00+02:00', lastAt: '2026-10-29T01:00:00-02:00', hasFail: true,
    }]);
  });

  it('breaks equal instants by source line and retains explicitly empty errors', () => {
    const dir = fixture([
      event({ at: '2026-10-29T01:00:00+01:00', error: 'first', status: 'fail' }),
      event({ at: '2026-10-29T00:00:00.000Z', error: '' }),
      event({ at: '2026-10-28T22:00:00-02:00', owner: null }),
    ]);
    expect(readNight(dir, night)?.rows[0]).toMatchObject({
      firstAt: '2026-10-29T01:00:00+01:00', lastAt: '2026-10-28T22:00:00-02:00',
      owner: null, lastStatus: 'ok', lastError: '', hasFail: true,
    });
  });

  it('compares fractional seconds without rounding away source precision', () => {
    const dir = fixture([
      event({ at: '2026-10-29T00:00:00.1239Z', owner: 'latest' }),
      event({ at: '2026-10-29T00:00:00.1231Z', owner: 'first' }),
      event({ at: '2026-10-29T00:00:00.12310Z', owner: 'tied' }),
    ]);
    expect(readNight(dir, night)?.rows[0]).toMatchObject({
      firstAt: '2026-10-29T00:00:00.1231Z', lastAt: '2026-10-29T00:00:00.1239Z', owner: 'latest',
    });
  });

  it('preserves source strings and sorts case-sensitive job names without locale rules', () => {
    const jobs = ['z', 'a', 'A', '__proto__', ' job '];
    const dir = fixture(jobs.map(job => event({ job, owner: ' owner ', error: ' error ' })));
    const rows = readNight(dir, night)?.rows;
    expect(rows?.map(row => row.job)).toEqual([' job ', 'A', '__proto__', 'a', 'z']);
    expect(rows?.every(row => row.owner === ' owner ' && row.lastError === ' error ')).toBe(true);
  });

  it.each(['../2026-10-28', '..\\2026-10-28', '/2026-10-28', '2026-10-28.jsonl', '2026-02-29',
    '1900-02-29', '2026-00-01', '2026-13-01', '2026-04-31', '2026-01-00', '2026-1-01', '2026-10-28\n'])
  ('rejects invalid or unsafe night %j before file access', invalid => {
    const read = vi.mocked(fs.readFileSync);
    expect(readNight('runs', invalid)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it.each(['2000-02-29', '2024-02-29'])('accepts leap dates in filenames and events (%s)', leapDate => {
    const dir = fixture([event({ at: `${leapDate}T00:00:00Z` })], leapDate);
    expect(readNight(dir, leapDate)?.rows[0].firstAt).toBe(`${leapDate}T00:00:00Z`);
  });

  it.each(['EACCES', 'EIO', 'EISDIR', 'ENOTDIR'])('propagates %s instead of reporting a missing night', code => {
    const failure = Object.assign(new Error('read failed'), { code });
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw failure; });
    expect(() => readNight('runs', night)).toThrow(failure);
  });
});
