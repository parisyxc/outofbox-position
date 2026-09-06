// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages serves a project site under /<repo>/. Override with BASE_PATH=/ for
// a root deploy (Vercel, custom domain).
const base = process.env.BASE_PATH ?? '/outofbox-position';

export default defineConfig({
  site: 'https://parisyxc.github.io',
  base,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
