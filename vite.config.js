import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const GITHUB_PAGES_REPO = 'mdviewer';

export default defineConfig(({ mode }) => {
  const isGitHubPagesBuild = mode === 'github-pages';

  return {
    /**
     * Locale/dev/preview:
     *   base: './'
     *
     * GitHub Pages repo:
     *   https://<utente>.github.io/mdviewer/
     *   base: '/mdviewer/'
     */
    base: isGitHubPagesBuild ? `/${GITHUB_PAGES_REPO}/` : './',

    plugins: mode === 'https-dev' ? [basicSsl()] : [],

    build: {
      target: 'es2022',
      sourcemap: true,
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