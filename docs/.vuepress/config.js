import { defaultTheme } from '@vuepress/theme-default';
import { defineUserConfig } from 'vuepress/cli';
import { viteBundler } from '@vuepress/bundler-vite';

export default defineUserConfig({
  lang: 'en-US',
  base: '/evnty/',
  title: 'Evnty',
  description: '0-dependency, high-performance, reactive event handling library optimized for both browser and Node.js environments. This library introduces a robust and type-safe abstraction for handling events, reducing boilerplate and increasing code maintainability.',

  theme: defaultTheme({
    colorMode: 'dark',
    colorModeSwitch: false,
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'GitHub', link: 'https://github.com/3axap4ehko/evnty' }
    ],
  }),

  bundler: viteBundler(),

  markdown: {
    anchor: {
      slugify: (s) => s.replace(/[\s-]+/g, '-').replace(/[^\w-]+/g, '').toLowerCase(),
    },
  },
});
