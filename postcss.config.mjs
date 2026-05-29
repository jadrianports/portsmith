// Tailwind v4 CSS-first setup (see repo-root CLAUDE.md "Tailwind v4 — CSS-first setup").
// The v4 PostCSS plugin replaces the v3 `tailwindcss` entry and removes the need for
// `autoprefixer` + `postcss-import` (both handled internally by the Oxide engine).
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
