import { defaultTheme } from '@vuepress/theme-default';
import { defineUserConfig } from 'vuepress/cli';
import { viteBundler } from '@vuepress/bundler-vite';

export default defineUserConfig({
  lang: 'en-US',
  base: '/evnty/',
  title: 'Evnty',
  description:
    '0-dependency, high-performance, reactive event handling library optimized for both browser and Node.js environments. This library introduces a robust and type-safe abstraction for handling events, reducing boilerplate and increasing code maintainability.',

  head: [
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/evnty/apple-touch-icon.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/evnty/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/evnty/favicon-16x16.png' }],
    ['link', { rel: 'manifest', href: '/evnty/site.webmanifest' }],
    ['link', { rel: 'mask-icon', href: '/evnty/safari-pinned-tab.svg', color: '#3a0839' }],
    ['link', { rel: 'shortcut icon', href: '/evnty/favicon.ico' }],
    ['meta', { name: 'msapplication-TileColor', content: '#3a0839' }],
    ['meta', { name: 'msapplication-config', content: '/evnty/browserconfig.xml' }],
    ['meta', { name: 'theme-color', content: '#424242' }],
  ],

  theme: defaultTheme({
    colorMode: 'dark',
    colorModeSwitch: false,
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'GitHub', link: 'https://github.com/3axap4ehko/evnty' },
    ],
  }),

  bundler: viteBundler(),

  markdown: {
    html: false,
    anchor: {
      slugify: (s) =>
        s
          .replace(/[\s-]+/g, '-')
          .replace(/[^\w-]+/g, '')
          .toLowerCase(),
    },
  },
});
