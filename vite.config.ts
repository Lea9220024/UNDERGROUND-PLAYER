import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: [],
    manifest: {
      name: 'UNDERGROUND Offline Player', short_name: 'UNDERGROUND',
      description: 'Tu música. Tu dispositivo. Sin streaming.',
      theme_color: '#0b0b0d', background_color: '#0b0b0d', display: 'standalone', start_url: '/',
      icons: [{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] }
  })]
});
