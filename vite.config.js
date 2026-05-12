import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const GITHUB_PAGES_REPO = 'mdviewer';
const DEV_PAGES_SEGMENT = 'dev';

function resolveBase(mode) {
  if (mode === 'github-pages-dev') {
    return `/${GITHUB_PAGES_REPO}/${DEV_PAGES_SEGMENT}/`;
  }

  if (mode === 'github-pages') {
    return `/${GITHUB_PAGES_REPO}/`;
  }

  return './';
}

function mdViewerBuildVariantPlugin(mode) {
  const isDevPagesBuild = mode === 'github-pages-dev';

  return {
    name: 'mdviewer-build-variant',

    transformIndexHtml(html) {
      if (!isDevPagesBuild) {
        return html;
      }

      return html
        .replace('href="./icons/icon-192.svg"', 'href="./icons/icon-dev-192.svg"')
        .replace('<title>Markdown Viewer PWA</title>', '<title>Markdown Viewer DEV</title>');
    },

    closeBundle() {
      if (!isDevPagesBuild) {
        return;
      }

      const manifestPath = resolve(process.cwd(), 'dist', 'manifest.webmanifest');
      if (!existsSync(manifestPath)) {
        return;
      }

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.name = 'Markdown Viewer DEV';
      manifest.short_name = 'MD Dev';
      manifest.description = 'Versione dev/WIP del visualizzatore Markdown installabile.';
      manifest.icons = [
        {
          src: './icons/icon-dev-192.svg',
          sizes: '192x192',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        },
        {
          src: './icons/icon-dev-512.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ];

      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  };
}

export default defineConfig(({ mode }) => {
  const isGitHubPagesBuild = mode === 'github-pages' || mode === 'github-pages-dev';

  return {
    /**
     * Locale/dev/preview:
     *   base: './'
     *
     * GitHub Pages stable:
     *   https://alxsty.github.io/mdviewer/
     *   base: '/mdviewer/'
     *
     * GitHub Pages dev/WIP:
     *   https://alxsty.github.io/mdviewer/dev/
     *   base: '/mdviewer/dev/'
     */
    base: resolveBase(mode),

    plugins: [
      ...(mode === 'https-dev' ? [basicSsl()] : []),
      mdViewerBuildVariantPlugin(mode)
    ],

    build: {
      target: 'es2022',
      sourcemap: !isGitHubPagesBuild,
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks: {
            markdown: [
              'markdown-it',
              'markdown-it-footnote',
              'markdown-it-task-lists',
              'markdown-it-container'
            ],
            sanitize: ['dompurify'],
            highlight: ['highlight.js']
          }
        }
      }
    },

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true
    },

    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true
    }
  };
});
