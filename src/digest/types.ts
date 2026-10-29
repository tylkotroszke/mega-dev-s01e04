/** A valid run-log event's status. Counts below count events, not jobs. */
export type RunStatus = 'ok' | 'retry' | 'fail';

export type StatusCounts = Record<RunStatus, number>;

/** One job's events, aggregated once for both HTML and JSON consumers. */
export type DigestRow = {
  job: string;
  /** Owner on the latest event, including an explicitly null owner. */
  owner: string | null;
  /** All valid events for this job, including retries and failures. */
  runs: number;
  /** Number of retry events, not runs minus one. */
  retries: number;
  lastStatus: RunStatus;
  /** Latest recorded error by event time; later events without error do not clear it. */
  lastError: string | null;
  /** Original timestamp strings, including source offsets; never UTC-normalized. */
  firstAt: string;
  lastAt: string;
  /** True if any valid event failed, even when lastStatus is now ok. */
  hasFail: boolean;
};

/** An existing night's file; zero rows is a successful, empty digest. */
export type NightDigest = {
  night: string;
  /** Ascending job order using case-sensitive JavaScript string comparison. */
  rows: DigestRow[];
  /** Nonblank lines that fail JSON parsing or event validation. */
  malformedLines: number;
  /** Totals of valid events across all jobs; malformed lines contribute nothing. */
  counts: StatusCounts;
};

/**
 * Contract for readNight in ./reader.ts (implementation is a separate issue).
 * Read runsDir/<night>.jsonl synchronously. Return null for a missing file or an
 * invalid YYYY-MM-DD night; propagate other I/O failures. Never write to runsDir.
 * Blank lines are ignored. Malformed lines are counted and skipped, never thrown.
 * Order events by timestamp instant, breaking ties by ascending file position.
 * See docs/digest-contract.md for validation and shared HTML/JSON semantics.
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
