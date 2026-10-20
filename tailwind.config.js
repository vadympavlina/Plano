/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        sidebar: token('sidebar'),
        'sidebar-fg': token('sidebar-fg'),
        'sidebar-muted': token('sidebar-muted'),
        'sidebar-active': token('sidebar-active'),
        ink: token('ink'),
        muted: token('muted'),
        subtle: token('subtle'),
        line: token('line'),
        primary: token('primary'),
        'primary-fg': token('primary-fg'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        purple: token('purple'),
        accent: token('accent'),
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        // Individual transform properties (scale / translate) so the animation never
        // overrides the element's own centering transform.
        'scale-in': { from: { opacity: '0', scale: '0.97' }, to: { opacity: '1', scale: '1' } },
        'slide-up': { from: { opacity: '0', translate: '0 16px' }, to: { opacity: '1', translate: '0 0' } },
        'slide-in-right': { from: { translate: '100% 0' }, to: { translate: '0 0' } },
        'sheet-up': { from: { translate: '0 100%' }, to: { translate: '0 0' } },
        // Opacity only: a transform would re-anchor fixed elements inside the page while it runs.
        'page-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-up': 'slide-up 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'sheet-up': 'sheet-up 280ms cubic-bezier(0.2, 0.9, 0.25, 1)',
        'page-in': 'page-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
