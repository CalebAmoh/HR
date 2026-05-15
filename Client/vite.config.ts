import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
        port: 3002,
        host: '0.0.0.0',

        proxy: {
          // All requests that start with /v1/api/school-management → forward to backend port 3030
          "/v1/api/hr": {
            target: "http://localhost:3040",       // ← change to 3006 if that's your real backend port now
            changeOrigin: true,
            secure: false,
          },
          '/uploads': {
              target: 'http://localhost:3040',
              changeOrigin: true,
          },
        },
      },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    }
  };
});
