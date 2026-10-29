import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';

const { readNightMock } = vi.hoisted(() => ({ readNightMock: vi.fn() }));
vi.mock('../src/digest/reader.js', () => ({ readNight: readNightMock }));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  beforeEach(() => readNightMock.mockReset());

  it('links every night newest first and shows shared event counts', async () => {
    readNightMock.mockImplementation((_runsDir: string, night: string) => ({
      counts: night === '2026-10-28' ? { ok: 10, retry: 4, fail: 1 } : { ok: 7, retry: 0, fail: 0 },
    }));
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('10 ok · 4 retry · 1 fail');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toContain('7 ok · 0 retry · 0 fail');
    expect(html.indexOf('2026-10-28')).toBeLessThan(html.indexOf('2026-10-27'));
    expect(readNightMock.mock.calls).toEqual([
      ['runs', '2026-10-28'],
      ['runs', '2026-10-27'],
    ]);
  });

  it('keeps a link and marks counts missing if a night disappears', async () => {
    readNightMock.mockReturnValue(null);
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('<span class="mute">—</span>');
  });

  it('keeps the empty nights message when runs/ is missing', async () => {
    const res = await createApp({ ...config, runsDir: 'missing-runs-directory' }).request('/');
    expect(await res.text()).toContain('nothing in runs/');
    expect(readNightMock).not.toHaveBeenCalled();
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
