import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const base = mode === 'development' ? '/' : '/UNDERGROUND-PLAYER/';
  return {
    base,
    plugins: [react(), VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        id: base,
        name: 'UNDERGROUND Offline Player',
        short_name: 'UNDERGROUND',
        description: 'Tu música. Tu dispositivo. Sin streaming.',
        lang: 'es-AR',
        dir: 'ltr',
        theme_color: '#0b0b0d',
        background_color: '#0b0b0d',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: base,
        scope: base,
        categories: ['music', 'entertainment'],
        icons: [
          { src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: base + 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: 'index.html' }
    })]
  };
});
