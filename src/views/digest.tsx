import type { NightDigest } from '../digest/types.js';

const display = (value: string | null) => value === null ? '—' : value;

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      <p>
        events: {digest.counts.ok} ok · {digest.counts.retry} retry · {digest.counts.fail} fail
        {' · '}malformed lines: {digest.malformedLines}
      </p>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <div class="table-scroll" role="region" aria-label={`Digest rows for ${digest.night}`} tabindex={0}>
          <table class="digest-table">
            <thead>
              <tr>
                <th scope="col">job</th>
                <th scope="col">owner</th>
                <th scope="col">runs</th>
                <th scope="col">retries</th>
                <th scope="col">last status</th>
                <th scope="col">last error</th>
                <th scope="col">first time</th>
                <th scope="col">last time</th>
                <th scope="col">had failure</th>
              </tr>
            </thead>
            <tbody>
              {digest.rows.map((row) => {
                const needsAttention = row.retries >= 3 || row.hasFail;
                return (
                  <tr class={needsAttention ? 'attention' : undefined}>
                    <th scope="row">{row.job}</th>
                    <td>{display(row.owner)}</td>
                    <td>{row.runs}</td>
                    <td>{row.retries}</td>
                    <td>{row.lastStatus}</td>
                    <td>{display(row.lastError)}</td>
                    <td>{row.firstAt}</td>
                    <td>{row.lastAt}</td>
                    <td>{row.hasFail ? 'yes' : 'no'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
