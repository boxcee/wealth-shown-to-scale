import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// GitHub Pages serves project sites under /<repo>/. Override with BASE_PATH
// (e.g. BASE_PATH=/ for a custom domain or local preview at the root).
const base = process.env.BASE_PATH ?? '/wealth-shown-to-scale/';

/**
 * Serves the repository's data/ directory at <base>data/ in dev and copies it
 * into dist/data at build time. The data files are the only thing the site
 * fetches at runtime.
 */
function dataDir(): Plugin {
  const dir = resolve(__dirname, 'data');
  return {
    name: 'data-dir',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        const prefix = `${base}data/`;
        if (!url.startsWith(prefix)) return next();
        const file = resolve(dir, decodeURIComponent(url.slice(prefix.length)));
        if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      cpSync(dir, resolve(__dirname, 'dist', 'data'), { recursive: true, filter: (src) => !src.includes('.cache') });
    },
  };
}

export default defineConfig({
  base,
  publicDir: 'public',
  plugins: [dataDir()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
