
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, resolve(process.cwd(), 'server'), '');
  const apiTarget = serverEnv.API_URL || `http://127.0.0.1:${serverEnv.PORT || '3001'}`;

  return {
    base: '/Research-Lens-Project/',

    plugins: [react()],

    server: {
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'dist',
    },
  };
});
