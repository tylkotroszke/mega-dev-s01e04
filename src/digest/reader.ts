import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type Event = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
  time: number;
  fraction: string;
  line: number;
};

function isDate(value: string): boolean {
  if (value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function parseEvent(source: string, line: number): Event | null {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { at, job, status, owner, error } = record;
  if (typeof at !== 'string' || typeof job !== 'string' || job.length === 0 ||
      (status !== 'ok' && status !== 'retry' && status !== 'fail') ||
      (typeof owner !== 'string' && owner !== null) ||
      ('error' in record && typeof error !== 'string')) return null;

  const timestamp = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(at);
  if (!timestamp || timestamp[0] !== at) return null;
  const [, date, hour, minute, second, fraction = '', zone] = timestamp;
  if (!isDate(date) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 ||
      (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) return null;
  // Compare whole seconds and fractional digits separately, without losing sub-ms order.
  const time = Date.parse(`${date}T${hour}:${minute}:${second}${zone}`);
  if (!Number.isFinite(time)) return null;
  return { at, job, status, owner, error: error as string | undefined, time,
    fraction: fraction.replace(/0+$/, ''), line };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!isDate(night)) return null;
  let source: string;
  try {
    source = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const result: NightDigest = { night, rows: [], malformedLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
  const events: Event[] = [];
  source.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '') return;
    const event = parseEvent(line, index);
    if (event) events.push(event);
    else result.malformedLines++;
  });
  events.sort((left, right) => left.time - right.time ||
    compareText(left.fraction, right.fraction) || left.line - right.line);

  const rows = new Map<string, DigestRow>();
  for (const event of events) {
    result.counts[event.status]++;
    let row = rows.get(event.job);
    if (!row) {
      row = { job: event.job, owner: event.owner, runs: 0, retries: 0,
        lastStatus: event.status, lastError: null, firstAt: event.at, lastAt: event.at, hasFail: false };
      rows.set(event.job, row);
    }
    row.runs++;
    if (event.status === 'retry') row.retries++;
    if (event.status === 'fail') row.hasFail = true;
    if (event.error !== undefined) row.lastError = event.error;
    row.owner = event.owner;
    row.lastStatus = event.status;
    row.lastAt = event.at;
  }
  result.rows = [...rows.values()].sort((left, right) => compareText(left.job, right.job));
  return result;
};
