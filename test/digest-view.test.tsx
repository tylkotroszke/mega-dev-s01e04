import { renderToString } from 'hono/jsx/dom/server';
import { describe, expect, it } from 'vitest';
import type { NightDigest } from '../src/digest/types.js';
import { DigestPage } from '../src/views/digest.js';

const digest: NightDigest = {
  night: '2026-10-28',
  malformedLines: 1,
  counts: { ok: 1, retry: 4, fail: 0 },
  rows: [
    {
      job: 'refresh', owner: null, runs: 4, retries: 3, lastStatus: 'ok',
      lastError: 'upstream 503', firstAt: '2026-10-28T23:50:00-04:00',
      lastAt: '2026-10-29T00:05:00-04:00', hasFail: true,
    },
  ],
};

describe('digest view', () => {
  it('renders every field, keeps source offsets, and emphasizes retries or any failure', () => {
    const html = renderToString(<DigestPage digest={digest} />);
    expect(html).toContain('2026-10-28');
    expect(html).toContain('1 ok · 4 retry · 0 fail');
    expect(html).toContain('malformed lines: 1');
    expect(html).toContain('refresh');
    expect(html).toContain('—');
    expect(html).toContain('3');
    expect(html).toContain('ok');
    expect(html).toContain('upstream 503');
    expect(html).toContain('2026-10-28T23:50:00-04:00');
    expect(html).toContain('2026-10-29T00:05:00-04:00');
    expect(html).toContain('yes');
    expect(html).toContain('class="attention"');
  });

  it('shows an empty successful night as nothing ran', () => {
    const html = renderToString(
      <DigestPage digest={{ ...digest, rows: [], counts: { ok: 0, retry: 0, fail: 0 }, malformedLines: 0 }} />,
    );
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });
});
