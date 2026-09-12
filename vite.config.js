import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// En production, l'application est servie depuis https://techbadji.github.io/timer/ ;
// en développement elle reste à la racine du serveur local.
export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/timer/' : '/'

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'sw-notifications.js'],
        manifest: {
          name: 'Timer — Emploi du temps',
          short_name: 'Timer',
          description: "Gestion d'emploi du temps, quotas horaires et rémunération",
          lang: 'fr',
          dir: 'ltr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0f172a',
          theme_color: '#4f46e5',
          categories: ['productivity', 'education'],
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallback: `${base}index.html`,
          // Gère le clic sur les notifications de rappel de cours.
          importScripts: ['sw-notifications.js'],
        },
        devOptions: { enabled: true, type: 'module' },
      }),
    ],
    server: { host: true, port: 5173 },
  }
})
