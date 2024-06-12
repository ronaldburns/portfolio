/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    autoprefixer: {},
    "postcss-import": {},
    tailwindcss: {},
    "tailwindcss/nesting": "postcss-nesting",
  },
};

export default config;
