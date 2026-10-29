import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RigConfig } from '../config.js';
import type { NightDigest } from './types.js';

const { readNightMock } = vi.hoisted(() => ({ readNightMock: vi.fn() }));

vi.mock('./reader.js', () => ({ readNight: readNightMock }));

import { registerDigestJsonRoute } from './json-route.js';

const config: RigConfig = {
  adapter: 'test',
  installed: 'test',
  beatEverySeconds: 60,
  runsDir: '/tmp/runs',
};

function createApp(): Hono {
  const app = new Hono();
  registerDigestJsonRoute(app, config);
  return app;
}

describe('GET /api/digest/:night', () => {
  beforeEach(() => readNightMock.mockReset());

  it('returns the shared digest unchanged, including nulls and timestamp offsets', async () => {
    const digest: NightDigest = {
      night: '2026-10-28',
      rows: [
        {
          job: 'digest/render',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T23:55:00-04:00',
          lastAt: '2026-10-28T23:55:00-04:00',
          hasFail: false,
        },
      ],
      malformedLines: 1,
      counts: { ok: 1, retry: 0, fail: 0 },
    };
    readNightMock.mockReturnValue(digest);

    const response = await createApp().request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(digest);
    expect(readNightMock).toHaveBeenCalledWith('/tmp/runs', '2026-10-28');
  });

  it('returns the documented 404 shape when the night is missing', async () => {
    readNightMock.mockReturnValue(null);

    const response = await createApp().request('/api/digest/2026-10-29');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'night not found' });
    expect(readNightMock).toHaveBeenCalledWith('/tmp/runs', '2026-10-29');
  });

  it('returns an empty existing night as a successful digest', async () => {
    const digest: NightDigest = {
      night: '2026-10-28',
      rows: [],
      malformedLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    };
    readNightMock.mockReturnValue(digest);

    const response = await createApp().request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(digest);
  });
});
