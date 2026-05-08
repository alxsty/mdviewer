import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ command, mode }) => ({
  base: './',
  plugins: mode === 'https-dev' ? [basicSsl()] : [],
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          markdown: ['markdown-it', 'markdown-it-footnote', 'markdown-it-task-lists', 'markdown-it-container'],
          sanitize: ['dompurify'],
          highlight: ['highlight.js']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  }
}));
