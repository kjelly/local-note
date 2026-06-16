import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.js'],
  },
});
