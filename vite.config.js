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

    plugins: mode === 'https-dev' ? [basicSsl()] : [],

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
