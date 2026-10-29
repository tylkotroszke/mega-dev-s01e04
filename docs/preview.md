# Digest preview — local preparation for issue #7

Status: local export is implemented. Publication, Mateusz's manual findings, course submission
and received review are still pending. Issue #7 remains open. Issue #8 must wait for received
review and approval of the exact replacement. This document authorizes no external writes.

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
`docs/manual-testbook.md`. That file is prepared by issue #6; its manual findings remain
NOT RUN until Mateusz performs them. The live page is also available from `pnpm start` at
`http://127.0.0.1:8787/digest/2026-10-28` (or the configured `PORT`). That live command loads
`.env`; the export command deliberately does not. `.gitignore` excludes `.preview/`, common
preview directories and all `.html`/`.htm` files. Check before staging:

```sh
git check-ignore .preview/marked/index.html .preview/clean/index.html
git diff --cached --name-only
```

## Proposed publication — not installed or run

Use GitHub Pages' Actions source after approval of the exact settings change, workflow,
secret provisioning, approved commit and generated contents. This keeps the marked HTML
out of Git history and allows a later clean export to replace the same site root. Publishing
a committed HTML file would retain the marker in Git history, contrary to ADR 0003.

The complete proposed `.github/workflows/preview.yml` is below. It has only
`workflow_dispatch`, so pushing code does not deploy. Every dispatch still needs Mateusz's
approval of that exact attempt and selected `mode`; a workflow input is not approval.
Use an approved default-branch commit. The future `github-pages` environment must be
configured to require Mateusz's deployment approval before any run. No such environment,
secret, Pages setting or workflow is created by this local preparation.

```yaml
name: Approved digest preview

on:
  workflow_dispatch:
    inputs:
      mode:
        description: Approved publication mode
        required: true
        type: choice
        options: [marked, clean]

permissions: {}

concurrency:
  group: digest-preview-pages
  cancel-in-progress: false

jobs:
  build:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - uses: pnpm/action-setup@v4
        with:
          version: '11.25.0'
          run_install: false
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - name: Export marked digest
        if: inputs.mode == 'marked'
        env:
          LANE_MARKER: ${{ secrets.LANE_MARKER }}
        run: pnpm preview:export --marked
      - name: Export clean digest
        if: inputs.mode == 'clean'
        run: pnpm preview:export --clean
      - name: Upload only the generated HTML
        uses: actions/upload-pages-artifact@v4
        with:
          path: .preview/${{ inputs.mode }}/
          retention-days: 1

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/configure-pages@v5
      - name: Deploy approved artifact
        id: deployment
        uses: actions/deploy-pages@v4
```

The build job reads source and uploads a Pages artifact; only its marked export step receives
the repository secret. It never prints the marker or HTML. The deploy job gets Pages write
and OIDC token permissions. Only `index.html` from the chosen export directory is uploaded:
no `.env`, source, raw logs, private evidence or other preview mode. No dependency cache or
extra diagnostic HTML artifact is proposed. Pages configuration runs after the protected
environment approval. The template assumes `main`; confirm the actual default branch before
presenting the workflow for external approval.

Artifact retention is explicitly one day; that limits the uploaded Actions artifact, not
the public site's lifetime. The marked page stays public until the separately approved clean
deployment replaces it. After received review, issue #8 must obtain approval for that clean
dispatch and any early removal of the old artifact; do not claim retention automatically
cleans the website or erases third-party copies.

Before publication approval: present the exact local export's checks, Mateusz's manual
findings, workflow/permissions, secret destination, artifact policy and planned site contents.
No real marker belongs in that proposal. After approved publication: take the HTTPS URL from
the deployment output, fetch it without authentication, compare its HTML with the approved
export, and check the sample data/banner/assets. Do not invent a URL or recipient. Determine
the course's review channel and obtain separate approval of the exact repo/preview-link
submission. Submission evidence and received review are separate facts.

## Verified references

Checked 2026-10-29 against the official sources: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
documents `configure-pages@v5`, `upload-pages-artifact@v4` and `deploy-pages@v4`, their artifact
contract and deployment permissions. [upload-pages-artifact inputs](https://github.com/actions/upload-pages-artifact)
document `path` and `retention-days` (one day by default). The proposed setup refs exist in
the upstream [checkout v4](https://github.com/actions/checkout/tree/v4),
[setup-node v4](https://github.com/actions/setup-node/tree/v4) and
[pnpm/action-setup v4](https://github.com/pnpm/action-setup/tree/v4) repositories. These are
version tags; reassess the approved workflow if refs or settings change before publication.
