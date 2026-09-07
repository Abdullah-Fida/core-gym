import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        // Off in development. The plugin generates dev-dist/ and registers a
        // service worker there; when that folder is absent or stale the dev
        // server throws an ENOENT overlay over the app, and a SW caching
        // assets in dev only makes changes appear not to take effect.
        // The production build still ships the full PWA.
        enabled: false
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Batgos — Gym Management',
        short_name: 'Batgos',
        description: 'Elite Gym Management System',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        display: 'standalone',
        icons: [] // Re-enable once icon files are created in public/
      },
      workbox: {
        // Force immediate activation of new service worker
        skipWaiting: true,
        clientsClaim: true,
        // Clean up old precached assets
        cleanupOutdatedCaches: true,
        // Only precache app shell assets (JS/CSS have content hashes, so new builds = new files)
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // CRITICAL: Prevent the NavigationRoute from caching API responses
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // CRITICAL: API calls must ALWAYS go to network, NEVER be cached
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
})
