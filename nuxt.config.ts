import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-07',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  nitro: {
    preset: 'static',
    // Use Nuxt's built-in static preview without a separate server dependency.
    commands: { preview: '' },
    // Nuxt 4.6's renderer entrypoints must resolve their generated virtual modules.
    externals: { inline: ['nuxt/'] },
  },
  app: {
    head: {
      title: 'Keyboard Layout Editor',
      meta: [{ name: 'description', content: 'A local keyboard layout editor.' }],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
    },
  },
})
