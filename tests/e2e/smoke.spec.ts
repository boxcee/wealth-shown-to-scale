import { expect, test, type Page } from '@playwright/test';

const LANGS = ['en', 'de'] as const;
const PAGES = ['', 'rice/', 'spend/', 'germany/', 'taxes/', 'objections/', 'methodology/', 'credits/', 'imprint/', 'privacy/'];

const H1: Record<string, Record<string, RegExp>> = {
  en: { '': /Wealth, shown to scale/, 'rice/': /grains of rice/, 'spend/': /Spend a billionaire/, 'germany/': /Germany in proportion/, 'taxes/': /Taxes: nominal/, 'objections/': /Objections/, 'methodology/': /Methodology/, 'credits/': /Credits/, 'imprint/': /Imprint/, 'privacy/': /Privacy/ },
  de: { '': /Reichtum, maßstabsgetreu/, 'rice/': /Reiskörnern/, 'spend/': /Milliardärs ausgeben/, 'germany/': /Deutschland im Verhältnis/, 'taxes/': /Steuern: nominal/, 'objections/': /Einwände/, 'methodology/': /Methodik/, 'credits/': /Credits/, 'imprint/': /Impressum/, 'privacy/': /Datenschutz/ },
};

async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

for (const lang of LANGS) {
  for (const p of PAGES) {
    test(`${lang}/${p || '(scroll)'} renders with sourced numbers`, async ({ page }) => {
      const errors = await noConsoleErrors(page);
      await page.goto(`${lang}/${p}`);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('h1')).toHaveText(H1[lang][p]);
      // hreflang alternates from the static shell
      await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
      if (!['imprint/', 'privacy/', 'credits/'].includes(p)) {
        // at least one sourced number with a source button
        const btn = page.locator('.src-btn').first();
        await expect(btn).toBeVisible();
        await btn.click();
        await expect(page.locator('#src-pop')).toBeVisible();
        await expect(page.locator('#src-pop a[href^="http"]').first()).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#src-pop')).toBeHidden();
      }
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}

test('language switcher keeps the page and the browser language redirect works', async ({ page }) => {
  await page.goto('en/taxes/');
  await page.locator('.lang-switch a[data-lang="de"]').click();
  await expect(page).toHaveURL(/\/de\/taxes\/$/);
  await expect(page.locator('h1')).toHaveText(/Steuern/);
  await page.goto('?lang=de');
  await expect(page).toHaveURL(/\/de\/$/);
});

test('home: blocks to scale, a sideways strip, rice and spend on the same page', async ({ page, isMobile }) => {
  await page.goto('en/');
  // five blocks whose area is value / 1000 pixels
  await expect(page.locator('.block')).toHaveCount(6);
  const million = await page.locator('#b-million .block').boundingBox();
  expect(Math.round(million!.width * million!.height)).toBeGreaterThan(990);
  expect(Math.round(million!.width * million!.height)).toBeLessThan(1_010);
  const billion = await page.locator('#b-billion .block').boundingBox();
  expect(Math.round(billion!.width * billion!.height)).toBeGreaterThan(990_000);
  // desktop: the strip is a horizontal scroll container; phones: the bar runs downward
  const counter = page.locator('#counter');
  await expect(counter).toHaveText(/€0|\$0/);
  await expect(page.locator('#strip')).toHaveClass(isMobile ? /axis-y/ : /axis-x/);
  if (isMobile) {
    const top = await page.evaluate(() => document.getElementById('strip')!.getBoundingClientRect().top + window.scrollY);
    await page.evaluate((y) => window.scrollTo(0, y + 500), top);
  } else {
    await page.locator('#strip').scrollIntoViewIfNeeded();
    await page.evaluate(() => { document.getElementById('strip')!.scrollLeft = 500; });
  }
  await expect.poll(async () => (await counter.textContent()) ?? '').not.toMatch(/^[€$]0$/);
  await expect(page.locator('.seg-label').first()).toBeVisible();
  await expect(page.locator('.marker.objection').first()).toBeVisible();
  await expect.poll(() => page.url()).toMatch(/#x=\d+/);
  // a vertical mouse wheel over the sideways strip moves it (desktop only: phones just scroll)
  if (!isMobile) {
    await page.locator('#strip').hover();
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => document.getElementById('strip')!.scrollLeft)).toBeGreaterThan(700);
  }
  // deep link restores the position
  const url = page.url();
  await page.goto(url);
  await expect.poll(async () => (await counter.textContent()) ?? '').not.toMatch(/^[€$]0$/);
  // the end of the strip, then rice and spend
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#end')).toBeVisible();
  await expect(page.locator('#rice h2').first()).toHaveText(/rice/i);
  await expect(page.locator('#spend h2').first()).toHaveText(/Spend/);
  await expect(page.locator('#spend #budget option')).toHaveCount(2);
});

test('currency switch converts amounts', async ({ page }) => {
  await page.goto('en/germany/?cur=EUR');
  await expect(page.locator('td .num-value').first()).toContainText('€');
  await page.locator('[data-currency="USD"]').click();
  await expect(page.locator('td .num-value').first()).toContainText('$');
});

test('spend simulator buys and refuses overspending', async ({ page }) => {
  await page.goto('en/spend/');
  const row = page.locator('.item[data-id="teacher_year"]');
  await row.locator('[data-inc]').click();
  await expect(page.locator('#summary')).toContainText(/You bought/);
  await page.locator('#budget').selectOption({ index: 0 });
  await page.locator('#reset').click();
  await expect(page.locator('#summary')).toHaveText(/Nothing bought/);
});

test('tax calculator responds to input', async ({ page }) => {
  await page.goto('de/taxes/');
  const out = page.locator('#c-out');
  await expect(out).toContainText('Deine Einkommensteuer');
  await page.locator('#c-income').fill('80000');
  await expect(out).toContainText(/€/);
  await page.locator('#c-country').selectOption('US');
  await expect(out).toContainText('$');
});

test('no external requests at runtime', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:4173')) external.push(r.url()); });
  await page.goto('en/rice/');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});
