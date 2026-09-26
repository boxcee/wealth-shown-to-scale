import { t, tList, tRaw } from '../i18n';
import { getData, isStale } from '../data';
import { date, escapeHtml, number } from '../format';
import { formatValue, num } from '../ui/source';
import type { SourcedValue } from '../data/types';

const REPO = 'https://github.com/boxcee/wealth-shown-to-scale';

function collect(file: string, node: unknown, path: string, out: { file: string; key: string; v: SourcedValue }[]): void {
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if ('value' in o && 'source' in o && 'retrieved_at' in o) {
    out.push({ file, key: path.replace(/^\//, ''), v: o as unknown as SourcedValue });
    return;
  }
  for (const [k, v] of Object.entries(o)) {
    if (k === 'alt_sources' || k === 'series') continue;
    collect(file, v, `${path}/${k === 'wealth' ? '' : k}`.replace(/\/$/, ''), out);
  }
}

export function render(root: HTMLElement): () => void {
  const d = getData();
  const fx = d.exchange_rates.values.usd_per_eur;
  const sections = ['scale', 'wealth', 'reference', 'prices', 'taxes', 'pipeline', 'weaknesses'];
  const all: { file: string; key: string; v: SourcedValue }[] = [];
  for (const [name, file] of Object.entries(d)) {
    if (name === 'overrides' || name === 'credits') continue;
    collect(`${name}.json`, file, '', all);
  }
  const stale = all.filter((x) => isStale(x.v)).length;

  root.innerHTML = `
    <h1>${escapeHtml(t('methodology.title'))}</h1>
    <p class="lead">${escapeHtml(t('methodology.principle'))}</p>
    ${sections
      .map((s) => `<section><h2>${escapeHtml(t(`methodology.sections.${s}.h`))}</h2>${tList(`methodology.sections.${s}.p`, { rate: number(fx.value, 4), date: date(fx.as_of ?? fx.retrieved_at), threshold: '40 %' })
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('')}</section>`)
      .join('')}
    <h2>${escapeHtml(t('methodology.dataTable.h'))}</h2>
    <p class="small muted">${escapeHtml(t('common.staleBanner', { count: stale }))}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>${escapeHtml(t('methodology.dataTable.file'))}</th><th>${escapeHtml(t('methodology.dataTable.key'))}</th><th class="r">${escapeHtml(t('methodology.dataTable.value'))}</th><th>${escapeHtml(t('methodology.dataTable.asOf'))}</th><th>${escapeHtml(t('methodology.dataTable.retrieved'))}</th><th>${escapeHtml(t('methodology.dataTable.estimate'))}</th><th>${escapeHtml(t('methodology.dataTable.source'))}</th></tr></thead>
      <tbody>${all
        .map(
          (x) => `<tr><td><code>${escapeHtml(x.file)}</code></td><td><code>${escapeHtml(x.key)}</code></td><td class="r">${num(x.v, { text: x.v.unit === 'index' || x.v.unit === 'count' || x.v.unit === 'ratio' ? number(x.v.value, 4) : formatValue(x.v), label: x.key })}</td><td>${escapeHtml(x.v.as_of ?? '')}</td><td>${escapeHtml(x.v.retrieved_at)}</td><td>${x.v.is_estimate ? '≈' : ''}</td><td class="small"><a href="${escapeHtml(x.v.source_url)}" target="_blank" rel="noopener">${escapeHtml(x.v.source.length > 90 ? x.v.source.slice(0, 90) + '…' : x.v.source)}</a></td></tr>`,
        )
        .join('')}</tbody>
    </table></div>
    <p><a href="${REPO}/blob/main/DATA-CHANGELOG.md" rel="noopener">${escapeHtml(t('methodology.changelog'))}</a> · <a href="${REPO}" rel="noopener">${escapeHtml(t('methodology.repo'))}</a></p>
  `;
  void tRaw;
  return () => {};
}
