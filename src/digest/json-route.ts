import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './reader.js';

/** Register the JSON endpoint for the shared nightly digest model. */
export function registerDigestJsonRoute(app: Hono, config: RigConfig): void {
  app.get('/api/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));

    if (digest === null) {
      return c.json({ error: 'night not found' }, 404);
    }

    return c.json(digest);
  });
}
