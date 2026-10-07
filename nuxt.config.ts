export default defineNuxtConfig({
  // Arcon Sine, the design system, is the local layer in `layers/sine`, which
  // Nuxt extends on its own: its components, its stylesheet and Tailwind theme
  // (through @nuxtjs/tailwindcss), and its fonts. Its components, composables
  // and utilities are imported by path (`#layers/sine/…`), never by name.
  sine: { autoImports: false },
  compatibilityDate: '2026-10-07',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  typescript: {
    tsConfig: {
      // Sine's auto-imports are off, so a tag with no import is a type error
      // rather than an unknown element at runtime.
      vueCompilerOptions: { checkUnknownComponents: true },
    },
  },
  nitro: {
    preset: 'static',
    // Use Nuxt's built-in static preview without a separate server dependency.
    commands: { preview: '' },
    // Nuxt 4.6's renderer entrypoints must resolve their generated virtual modules.
    externals: { inline: ['nuxt/'] },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Keyboard layout editor',
      meta: [
        { name: 'description', content: 'A local keyboard layout editor.' },
        { name: 'color-scheme', content: 'light' },
        { name: 'theme-color', content: '#ffffff' },
      ],
      // Installable as its own window, with the title bar as the window's (see main.css).
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      ],
    },
  },
})
