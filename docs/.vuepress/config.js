import { defaultTheme } from '@vuepress/theme-default';
import { defineUserConfig } from 'vuepress/cli';
import { viteBundler } from '@vuepress/bundler-vite';

export default defineUserConfig({
  lang: 'en-US',
  base: '/evnty/',
  title: 'Evnty',
  description: '0-Deps, simple, fast, for browser and node js reactive anonymous event library',

  theme: defaultTheme({
    colorMode: 'dark',
    colorModeSwitch: false,
  }),

  bundler: viteBundler(),
});
