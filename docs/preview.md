# Digest preview — publication and cleanup record

The marked digest was first published on 2026-10-29 from main commit `734a9d2` at
[the public preview](https://tylkotroszke.github.io/mega-dev-s01e04/).
Pages deployment run `40869392780` succeeded with 40 tests and typecheck passing.
The public HTTPS response matched the approved local marked export. The repo and
preview links were submitted through the course's review channel. The course then
confirmed that the reviewer had seen the preview and requested human approval,
marker removal at the same URL, plan completion and resubmission of the same answer.
Submission, received review and course acceptance are separate recorded events.

Publication gate: keep this final archive commit local until Mateusz approves the
clean replacement, deployment from existing main commit `734a9d2` succeeds, and the
original URL passes the checks below. The final state described here is a staged
post-deployment record until that gate passes. This document authorizes no external
writes. Individual manual cases remain `NOT RUN` without Mateusz's actual results.

## Export the rendered page

Run from the repository with dependencies already available:

```sh
pnpm preview:export --marked
pnpm preview:export --clean
```

Choose exactly one mode per command. Marked mode requires the exact `LANE_MARKER` from
`start-challenge` to be present in the process environment; provision it privately without
putting its value into shell history, tracked files, logs, issues or chat attachments. The
command does not load `.env`. If the marker is missing or blank, marked mode fails.

The command binds a temporary HTTP server to `127.0.0.1` on an available port, requests the
actual `/digest/2026-10-28` route and saves its response byte-for-byte as UTF-8. It uses only
the repository's sample `runs/` directory. It does not start the heartbeat, alter fixtures,
reconstruct the table, install packages or contact a public host. The server closes before
the command finishes. A failed export exits nonzero and removes the prior output for that
mode, so an older preview cannot be mistaken for the new result.

| Mode | Output | Required banner |
| --- | --- | --- |
| `--marked` | `.preview/marked/index.html` | Current process marker, HTML-escaped by the layout |
| `--clean` | `.preview/clean/index.html` | `no marker set` |

Clean mode deletes `LANE_MARKER` before importing/rendering the app. It never starts
`pnpm start` or any command with `--env-file`, so a `.env` file cannot restore the marker.
When a marker was inherited, it also checks that its literal and HTML-escaped forms are
absent from the entire response. Both modes verify HTTP 200, HTML content type, the digest
title and marker span, and reject scripts, event handlers or external asset tags/CSS URLs.
The resulting page has one inline stylesheet and needs no browser JavaScript or network
assets. Keep both generated files local; neither is an attachment for review in chat.

Open the generated file in a browser for the actual export checks in
[the manual testbook](manual-testbook.md). The live page is also available from
`pnpm start` at `http://127.0.0.1:8787/digest/2026-10-28` (or the configured `PORT`).
That live command loads `.env`; the export command deliberately does not. `.gitignore`
excludes `.preview/`, common preview directories and all `.html`/`.htm` files. Check
before staging:

```sh
git check-ignore .preview/marked/index.html .preview/clean/index.html
git diff --cached --name-only
```

## Publication workflow

GitHub Pages uses the Actions source with the approved repository secret and
[workflow](../.github/workflows/preview.yml) on public `main`. The workflow runs only
on `workflow_dispatch`; pushing the archive commit does not deploy. Every dispatch
needs Mateusz's approval of that exact attempt and mode. There is no additional
required-reviewer gate on the `github-pages` environment.

The build job reads source, installs locked dependencies, runs typecheck and tests,
and uploads generated HTML. Only the marked export step receives the repository
secret; the clean step receives no marker secret. The deploy job has Pages write
and OIDC token permissions. Only `index.html` from the selected export directory
is uploaded, with one-day artifact retention. No HTML preview is committed.

The first marked artifact remains subject to its already approved one-day
retention, expiring on 2026-10-30 at 11:57:51 UTC. No early removal is proposed.
Artifact expiry does not remove the public website or third-party copies; the
approved clean deployment replaces the site at its existing address.

## Final cleanup record — publish after verification

The final state for issue #8 is the clean digest over the original URL:
[public preview](https://tylkotroszke.github.io/mega-dev-s01e04/).
The banner reads `no marker set`; the lane marker is absent from the entire HTML.
Sample digest data, styling and self-contained HTML are unchanged. The original
plan is archived with its source sections and actual issue list at
[docs/plans/done/morning-digest.md](plans/done/morning-digest.md).

Before publishing this archive commit, fetch that exact URL over HTTPS without
authentication, require HTTP 200, compare its complete response with the approved
clean export, verify that neither literal nor HTML-escaped marker forms occur,
and inspect the page in a fresh browser session. The prepared clean export from
`734a9d2` has SHA-256 `eadef9fc5962835d42282955b6f9c8530e6e17c3c640662585f6b5ef36af782d`;
locally it differs from the marked export only in the banner. This local check
does not replace public deployment verification. Retain the deployment and public
verification evidence privately, without committing HTML or the marker. Record
Mateusz's optional M08 result only if he performs it.

Keep issue #8 open until those checks pass and the archive commit is published.
Its closing comment then cites this commit without a circular commit reference.
Further course submission requires separate approval of the same repo/preview
answer. Cleanup alone does not prove course acceptance.

## Verified references

Checked 2026-10-29 against the official sources: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
documents `configure-pages@v5`, `upload-pages-artifact@v4` and `deploy-pages@v4`, their artifact
contract and deployment permissions. [upload-pages-artifact inputs](https://github.com/actions/upload-pages-artifact)
document `path` and `retention-days` (one day by default). The workflow's version tags
were checked against upstream [checkout v4](https://github.com/actions/checkout/tree/v4),
[setup-node v4](https://github.com/actions/setup-node/tree/v4) and
[pnpm/action-setup v4](https://github.com/pnpm/action-setup/tree/v4).
Reassess the approved workflow if refs or settings change before a new publication.
