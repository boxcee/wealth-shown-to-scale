import { t } from '../i18n';
import { getData } from '../data';
import { date, escapeHtml } from '../format';

export function render(root: HTMLElement): () => void {
  const d = getData();
  const c = d.credits;
  const notes: Record<string, string> = { korostoff: t('credits.korostoffNote'), yang: t('credits.yangNote'), agarwal: t('credits.agarwalNote') };
  const originals = c.originals
    .map((o) => {
      const link = o.url ? `<a href="${escapeHtml(o.url)}" rel="noopener" target="_blank">${escapeHtml(o.url)}</a>` : escapeHtml(t('credits.linkStatus.none'));
      return `<article class="card">
        <h3>${escapeHtml(o.title)}</h3>
        <p><strong>${escapeHtml(o.author)}</strong> · ${escapeHtml(t(`credits.relationship.${o.relationship}`))}</p>
        <p>${link}<br><span class="small muted">${escapeHtml(t(`credits.linkStatus.${o.url_status}`, { date: date(o.link_checked_at) }))}</span></p>
        ${o.mirror_url ? `<p class="small">${escapeHtml(t('credits.mirror'))}: <a href="${escapeHtml(o.mirror_url)}" rel="noopener" target="_blank">${escapeHtml(o.mirror_url)}</a></p>` : ''}
        ${o.repo_url ? `<p class="small">${escapeHtml(t('credits.repo'))}: <a href="${escapeHtml(o.repo_url)}" rel="noopener" target="_blank">${escapeHtml(o.repo_url)}</a></p>` : ''}
        <p class="small"><strong>${escapeHtml(t('credits.license'))}:</strong> ${escapeHtml(o.license)}</p>
        <p>${escapeHtml(notes[o.id] ?? '')}</p>
      </article>`;
    })
    .join('');

  // Data sources: unique source names across all data files.
  const sources = new Map<string, string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (typeof o.source === 'string' && typeof o.source_url === 'string') {
      const key = o.source.split(/[,(:–—]/)[0].trim();
      if (!sources.has(key)) sources.set(key, o.source_url);
    }
    for (const v of Object.values(o)) walk(v);
  };
  for (const [name, file] of Object.entries(d)) if (name !== 'credits' && name !== 'overrides') walk(file);

  root.innerHTML = `
    <h1>${escapeHtml(t('credits.title'))}</h1>
    <p class="lead">${escapeHtml(t('credits.lead'))}</p>
    <h2>${escapeHtml(t('credits.originals'))}</h2>
    ${originals}
    <p class="small muted">${escapeHtml(t('credits.otherFormats'))}</p>
    <h2>${escapeHtml(t('credits.dataSources'))}</h2>
    <ul>${[...sources.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([s, u]) => `<li><a href="${escapeHtml(u)}" rel="noopener" target="_blank">${escapeHtml(s)}</a></li>`).join('')}</ul>
    <h2>${escapeHtml(t('credits.libraries'))}</h2>
    <ul>${c.libraries.map((l) => `<li><a href="${escapeHtml(l.url)}" rel="noopener" target="_blank">${escapeHtml(l.name)}</a> — ${escapeHtml(l.license)} (${escapeHtml(t(`credits.libScope.${l.scope}`))})</li>`).join('')}</ul>
  `;
  return () => {};
}
