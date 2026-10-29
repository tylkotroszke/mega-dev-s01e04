# Morning digest contract

Status: shared contract for issue #1. The reader and routes are separate work;
this document does not claim those implementations are complete.

`src/digest/types.ts` is the shared source of field names and types. The runtime
reader will export `readNight` from `src/digest/reader.ts`, with the `ReadNight`
signature `(runsDir: string, night: string) => NightDigest | null`. It reads
synchronously, matching the existing status reader. Consumers may import the
types now; there is deliberately no runtime stub in the types module.

## Files and input

- `night` is an actual calendar date in `YYYY-MM-DD` form and selects exactly
  `<runsDir>/<night>.jsonl`. An invalid night returns `null` without reading a
  path; route parameters must never permit traversal outside `runsDir`.
- A missing file (`ENOENT`) returns `null`. A missing runs directory also means
  no file. Only `ENOENT` is translated to `null` for filesystem errors; other
  I/O failures propagate and permission failures must not masquerade as 404.
- An existing empty or whitespace-only file returns a `NightDigest` with the
  requested `night`, `rows: []`, `malformedLines: 0`, and zero for every count.
- Ignore blank lines, including a trailing newline. Each other line must parse
  as a non-null JSON object (not an array) with a nonempty string `job`, a valid
  ISO timestamp `at` including `Z` or a numeric offset, a `status` of `ok`,
  `retry`, or `fail`, and an `owner` that is a string or `null`. If present,
  `error` must be a string. Additional properties are ignored. Preserve strings
  as supplied; do not trim job names, owners, errors, or timestamps.
- A syntax error or invalid event contributes exactly one to `malformedLines`
  and nothing to rows or status counts. Continue reading later lines. A file
  containing only malformed lines is an existing night with zero rows and a
  nonzero malformed count, not a missing night.
- A night is the selected file, not a midnight filter: include valid events
  whose dates differ from the filename. Existing fixtures span midnight.

## Aggregation choices

These choices make details left open by the plan explicit. Aggregate once and
share the resulting model between the page, JSON route, and board.

Events are ordered by their parsed timestamp instant, then by their original
line position for equal instants. Offsets affect chronological comparison but
remain unchanged in output. Consequently, shuffled input is handled by event
time; equal-time ties select the earliest line for `firstAt` and the latest
line for `lastAt`, `lastStatus`, and `owner`.

Each distinct, case-sensitive `job` has one `DigestRow`:

| Field | Meaning |
| --- | --- |
| `job` | Exact source job name. Rows sort ascending using JavaScript string comparison (`<` / `>`), without locale rules. |
| `owner` | Owner of the last event in chronological order, including `null`; do not recover an earlier non-null owner. |
| `runs` | Count of all valid events for the job. |
| `retries` | Count of its `retry` events. |
| `lastStatus` | Status of its last event in chronological order. |
| `lastError` | Error from the last event that has an `error` property in chronological order, or `null` if none. A later event without an error does not erase it; an explicitly empty error string is still recorded. |
| `firstAt` | Original `at` string of the earliest event. |
| `lastAt` | Original `at` string of the latest event. |
| `hasFail` | Whether any valid event has status `fail`, regardless of the last status. |

`NightDigest.counts` contains `ok`, `retry`, and `fail` event counts, not counts
of jobs or final statuses. Their sum equals the sum of row `runs`, and the
`retry` total equals the sum of row `retries`. All counts are nonnegative
integers. There is no row without a valid event, so row times and last status
are never null.

## Consumer behavior

- HTML and JSON use the same `NightDigest`, including row order. They must not
  reparse events, reaggregate rows, or select different owners or errors.
- Missing nights (`null`) produce HTTP 404. Existing nights produce HTTP 200,
  including empty nights; an HTML page with zero rows says `nothing ran`.
- The successful JSON response is the `NightDigest` object itself:
  `{ night, rows, malformedLines, counts }`. JSON retains null values and
  original timestamp strings. The missing response is `{ error: 'night not found' }`.
- HTML substitutes `—` for null values only. Row emphasis uses `retries >= 3`
  and `hasFail`, rather than inferring failure only from `lastStatus`.
- The board uses `counts` from the same reader and links to that night's digest.
  Existing newest-first night ordering is separate from ascending job ordering.
- Banner, layout, export, and preview cleanup remain responsibilities of their
  existing components and later plan sections; they do not alter this model.

## Acceptance review

The contract covers plan section 1's fields, nullable owner and bad-line count;
section 2a's sorted table, retry/failure emphasis and empty/missing distinction;
2b's shared JSON values; 2c's event counts; and 2d's temporary-file test cases.
Sections 3 and 4 consume the rendered page without requiring another data
model. `pnpm typecheck` validates the shared declarations. Reader behavior and
route behavior must be verified when their separate implementations land.
