import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Ícones do app gerados a partir de public/icon.svg: `npx pwa-assets-generator`.
// Apple e maskable sem margem branca — o fundo do próprio ícone vai até a borda.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#191919' } },
    maskable: { sizes: [512], padding: 0.1, resizeOptions: { background: '#191919' } },
  },
  images: ['public/icon.svg'],
})
