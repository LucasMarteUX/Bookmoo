import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      // App instalável: manifest + service worker (shell offline, capas e modelos de voz em cache).
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg', 'illustrations/*.svg'],
        manifest: {
          id: '/',
          name: 'Upoonly',
          short_name: 'Upoonly',
          description: 'Leia, escute e aprenda inglês com seus livros.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#F6F3EE',
          theme_color: '#FBFBFA',
          categories: ['education', 'books'],
          icons: [
            {src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png'},
            {src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png'},
            {src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
            {src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
          shortcuts: [
            {name: 'Praticar fala', short_name: 'Falar', url: '/practice/speak', icons: [{src: 'pwa-192x192.png', sizes: '192x192'}]},
            {name: 'Minhas palavras', short_name: 'Palavras', url: '/vocabulary', icons: [{src: 'pwa-192x192.png', sizes: '192x192'}]},
            {name: 'Galeria', url: '/gallery', icons: [{src: 'pwa-192x192.png', sizes: '192x192'}]},
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // Personagens fora do pré-download: eram ~41 MB de PNG baixados de uma vez na primeira visita (pesado no celular).
          // O app carrega só o pacote WebP do personagem aberto, guardado no cache quando é usado (regra abaixo).
          globIgnores: ['characters/**', 'content/**'],
          // Chunks gigantes (WASM do TTS) ficam fora do precache; vão para o cache em tempo de uso.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Pacote do personagem (model.json e texturas WebP): imutável por versão (?v=), baixa uma vez.
              urlPattern: ({url}) => url.origin === self.location.origin && url.pathname.startsWith('/characters/'),
              handler: 'CacheFirst',
              options: {cacheName: 'characters', expiration: {maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60}, cacheableResponse: {statuses: [0, 200]}},
            },
            {
              urlPattern: ({url}) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {cacheName: 'google-fonts', expiration: {maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365}, cacheableResponse: {statuses: [0, 200]}},
            },
            {
              // Capas e imagens públicas do Supabase Storage.
              urlPattern: ({url}) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/public/'),
              handler: 'StaleWhileRevalidate',
              options: {cacheName: 'covers', expiration: {maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30}, cacheableResponse: {statuses: [0, 200]}},
            },
            {
              // Modelos de voz/IA (Hugging Face CDN): grandes e imutáveis — baixa uma vez.
              urlPattern: ({url}) => /(^|\.)huggingface\.co$|(^|\.)hf\.co$/.test(url.hostname) || url.hostname === 'cdn.jsdelivr.net',
              handler: 'CacheFirst',
              options: {cacheName: 'ai-models', expiration: {maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90}, cacheableResponse: {statuses: [0, 200]}, rangeRequests: true},
            },
            {
              urlPattern: ({request, url}) => request.destination === 'script' && /\.wasm$|ort|onnx/.test(url.pathname),
              handler: 'CacheFirst',
              options: {cacheName: 'wasm', expiration: {maxEntries: 20}},
            },
          ],
        },
        devOptions: {enabled: false},
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
