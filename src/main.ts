import './styles.css';
import { setLanguage, t } from './i18n';
import { parseLocation, pathFor, rememberLanguage, resolveLanguage, type Page } from './router';
import { initCurrency, loadData, setCurrency } from './data';
import { pageShell } from './ui/layout';
import { installSourcePopovers } from './ui/source';
import type { Currency } from './format';

type PageModule = { render: (root: HTMLElement) => void | (() => void) };

const pages: Record<Page, () => Promise<PageModule>> = {
  scroll: () => import('./pages/scroll'),
  rice: () => import('./pages/rice'),
  spend: () => import('./pages/spend'),
  germany: () => import('./pages/germany'),
  taxes: () => import('./pages/taxes'),
  objections: () => import('./pages/objections'),
  methodology: () => import('./pages/methodology'),
  credits: () => import('./pages/credits'),
  imprint: () => import('./pages/legal'),
  privacy: () => import('./pages/legal'),
};

let cleanup: (() => void) | void;

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  const { route, langFromQuery, needsRedirect } = parseLocation();
  if (!route || needsRedirect) {
    const lang = route?.lang ?? resolveLanguage(langFromQuery);
    const page = route?.page ?? 'scroll';
    const params = new URLSearchParams(location.search);
    params.delete('lang');
    const q = params.toString();
    location.replace(pathFor(lang, page) + (q ? `?${q}` : '') + location.hash);
    return;
  }
  rememberLanguage(route.lang);
  const params = new URLSearchParams(location.search);
  initCurrency(params.get('cur'));

  app.innerHTML = `<p class="loading">${t('common.loading') || 'Loading…'}</p>`;
  try {
    await Promise.all([setLanguage(route.lang), loadData()]);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p class="error" role="alert">${t('common.loadError')}</p>`;
    return;
  }
  document.title = `${t(`pages.${route.page}.title`)} · ${t('meta.siteName')}`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t(`pages.${route.page}.description`));

  const mod = await pages[route.page]();
  document.body.classList.toggle('home', route.page === 'scroll');
  app.innerHTML = pageShell(route.page, '');
  const main = app.querySelector<HTMLElement>('main')!;
  cleanup = mod.render(main);
  installSourcePopovers(app);
  wireHeader(app, route.page);
}

function wireHeader(app: HTMLElement, page: Page): void {
  const menuBtn = app.querySelector<HTMLButtonElement>('.menu-btn');
  const nav = app.querySelector<HTMLElement>('#site-nav');
  menuBtn?.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!open));
    nav?.classList.toggle('open', !open);
  });
  app.querySelectorAll<HTMLButtonElement>('[data-currency]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const c = btn.dataset.currency as Currency;
      setCurrency(c);
      const params = new URLSearchParams(location.search);
      params.set('cur', c);
      history.replaceState(null, '', `${location.pathname}?${params.toString()}${location.hash}`);
      // Re-render the page with the new currency.
      if (cleanup) cleanup();
      const mod = await pages[page]();
      app.innerHTML = pageShell(page, '');
      cleanup = mod.render(app.querySelector<HTMLElement>('main')!);
      installSourcePopovers(app);
      wireHeader(app, page);
    });
  });
}

boot();
