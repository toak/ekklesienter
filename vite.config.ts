import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import electron from 'vite-plugin-electron/simple'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3210,
      host: '0.0.0.0',
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      electron({
        main: {
          // Shortcut of `build.lib.entry`.
          entry: 'electron/main.ts',
        },
        preload: {
          // Shortcut of `build.rollupOptions.input`.
          // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
          input: 'electron/preload.ts',
          vite: {
            build: {
              rollupOptions: {
                output: {
                  format: 'cjs',
                  entryFileNames: '[name].cjs',
                },
              },
            },
          },
        },
        // Ployfill the Electron and Node.js built-in modules for Renderer process.
        // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
        renderer: {},
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          projector: path.resolve(__dirname, 'projector.html'),
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    // @ts-ignore
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.tsx'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'src/test/setup.tsx'],
      },
    },
  };
});
