import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const eohProxyTarget = (env.VITE_EOH_PROXY_TARGET || env.EOH_API_BASE_URL || 'https://backend.eoh.io/api')
    .replace(/\/+$/, '');
  const eohToken = env.EOH_API_TOKEN || env.VITE_EOH_API_TOKEN || '';
  const eohAuthorization = /^(token|bearer)\s+/i.test(eohToken) ? eohToken : `Token ${eohToken}`;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api/eoh': {
          target: eohProxyTarget,
          changeOrigin: true,
          headers: eohToken
            ? {
                Accept: 'application/json',
                Authorization: eohAuthorization,
              }
            : undefined,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/eoh/, ''),
        },
      },
    },
  };
});
