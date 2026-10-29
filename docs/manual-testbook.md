# S01E04 — manual digest testbook

Status: on 2026-10-29 Mateusz gave general positive visual feedback and agreed
to proceed, while noting the limited navigation and browser back/forward controls.
This is not confirmation of individual cases or of the 200%/narrow-width checks.
No individual manual case has a confirmed result. Results stay
`NOT RUN` until Mateusz performs the check. These are local acceptance checks
for the plan, styleguide, and the requested manual review; they are not a claim
that the course grades this document.

## Start the temporary local fixture server

From this repository, run:

```powershell
$env:PORT = '8788'
node --import tsx scripts/manual-test-server.ts
```

The script binds only to `127.0.0.1`, copies the tracked sample nights
2026-10-27 and 2026-10-28 into a new temporary runs directory, creates a
synthetic empty-night file there, and leaves a third date without a file. It
prints the actual URLs and removes its temporary directory when stopped with
Ctrl+C. It does not write to `runs/`. If port 8788 is occupied, set `PORT` to
another available port before running it.

For the default port, the local links are:

- Board: <http://127.0.0.1:8788/>
- Sample page: <http://127.0.0.1:8788/digest/2026-10-28>
- Previous sample page: <http://127.0.0.1:8788/digest/2026-10-27>
- Empty page: <http://127.0.0.1:8788/digest/2026-10-29>
- Missing page: <http://127.0.0.1:8788/digest/2026-10-30>
- Optional sample JSON: <http://127.0.0.1:8788/api/digest/2026-10-28>

Use the URLs printed by the running script if the port differs. The manual
server is for visual checks; automated route tests create and remove their own
temporary fixture directories.

## Run record

- Tester: Mateusz
- Date: not recorded
- Commit: fill in the tested commit
- Browser and window size: fill in during review
- Automated tests: fill in after `pnpm --config.verify-deps-before-run=false test`
- Typecheck: fill in after `pnpm --config.verify-deps-before-run=false typecheck`

| ID | Steps | Expected result | Actual result / notes | Status |
| --- | --- | --- | --- | --- |
| M01 — Sample rows and malformed input | Open the sample page. Count the data rows and inspect the malformed-line count. | HTTP 200; 5 jobs in ascending order; one malformed line is reported and does not remove valid rows. | — | NOT RUN |
| M02 — Null owner, retry emphasis, and failure history | On the sample page, inspect `digest/render`, `fixtures/refresh`, and `notes/backup`. | `digest/render` has owner `—` and keeps its `+01:00` timestamp. `fixtures/refresh` has 3 retries, ends `ok`, and is emphasized. `notes/backup` shows `quota exceeded` and is emphasized for its failure. | — | NOT RUN |
| M03 — Empty versus missing night | Open the empty and missing page links. If needed, use browser developer tools or `curl.exe -i` to inspect status codes. | Empty file: HTTP 200 and “nothing ran”, without a table. Missing file: HTTP 404 with a clear not-found response. | — | NOT RUN |
| M04 — Readability at normal, 200%, and narrow widths | Inspect the sample page at normal zoom, at 200% zoom, then in a narrow browser window. Scroll the digest horizontally if needed. | Headings and values remain understandable; columns do not overlap; long errors can be read; attention is conveyed by text as well as styling. Horizontal scrolling is acceptable. | — | NOT RUN |
| M05 — Actual exported HTML | After the export artifact for issue #7 is prepared, open that actual local HTML file and compare it with the sample page. Do not save or attach a marked preview copy in this repository or chat. | The exported file has the same five rows, values, order, styling, and lane banner; it is readable without JavaScript. | — | NOT RUN |

### Optional checks

Keep these separate from the core manual acceptance checks above.

| ID | Steps | Expected result | Actual result / notes | Status |
| --- | --- | --- | --- | --- |
| M06 — JSON parity and source offset | Open the optional sample JSON URL and compare it with the sample page. | Same five jobs and order; JSON owner is `null` where HTML shows `—`; `digest/render` retains `2026-10-29T05:41:09+01:00`. | — | NOT RUN |
| M07 — Board links | Open the board and follow the links for the two copied sample nights. | Both sample-night links open their digest pages; 2026-10-28 shows 10 ok / 4 retry / 1 fail and 2026-10-27 shows 7 ok / 0 retry / 0 fail. The synthetic empty night is only for M03 and is not expected on the board. | — | NOT RUN |

## After course review and approved replacement

Run M08 only after course review has arrived and Mateusz has approved the
replacement of the public artifact. The agent supplies the original public URL
after that step is authorized; this testbook does not pre-authorize publication
or replacement.

| ID | Steps | Expected result | Actual result / notes | Status |
| --- | --- | --- | --- | --- |
| M08 — Same URL without marker | In a fresh private browser window, open the supplied original public URL after the approved replacement. | The same URL still serves the digest with the same data and the banner says “no marker set”. The agent separately verifies that the marker is absent from the entire HTML response. | — | NOT RUN |

Record a result only after the corresponding step is actually performed. For
example: `M04 FAIL — at 200% the last-error value is clipped.` A failure can
prompt a local fix and retest; it does not authorize external publication.
