import { t, tList } from '../i18n';
import { escapeHtml } from '../format';

export function render(root: HTMLElement): () => void {
  const key = location.pathname.includes('/privacy') ? 'privacy' : 'imprint';
  root.innerHTML = `<h1>${escapeHtml(t(`${key}.title`))}</h1>${tList(`${key}.p`)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('')}`;
  return () => {};
}
