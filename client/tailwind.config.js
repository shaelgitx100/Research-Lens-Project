const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { bg: c('bg'), surface: c('surface'), raised: c('raised'), line: c('line'), ink: c('ink'), muted: c('muted'), accent: c('accent'), amber: c('amber'), good: c('good'), bad: c('bad') },
      fontFamily: { serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Georgia', 'serif'], sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
