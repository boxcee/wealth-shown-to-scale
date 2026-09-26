import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Finds a Chromium executable when the Playwright-managed build for the installed
 * version is missing (e.g. a sandbox that pre-installs one build under
 * PLAYWRIGHT_BROWSERS_PATH). Returns undefined to let Playwright use its own.
 *
 * Override explicitly with PW_CHROMIUM_PATH.
 */
export function findChromium(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort();
  for (const d of dirs.reverse()) {
    for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = resolve(root, d, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}
