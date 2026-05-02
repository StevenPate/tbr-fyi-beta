/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        paper: {
          light: 'var(--paper-light)',
          mid: 'var(--paper-mid)',
          DEFAULT: 'var(--paper-mid)',
          dark: 'var(--paper-dark)',
        },
        terracotta: {
          DEFAULT: 'var(--terracotta)',
          dark: 'var(--terracotta-dark)',
        },
        charcoal: 'var(--charcoal)',
        'warm-gray': 'var(--warm-gray)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-on-dark': 'var(--text-on-dark)',
        'surface-dark': {
          DEFAULT: 'var(--surface-dark)',
          secondary: 'var(--surface-dark-secondary)',
        },
        background: 'var(--background)',
        'background-alt': 'var(--background-alt)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },
        status: {
          read: 'var(--status-read)',
          owned: 'var(--status-owned)',
          'in-stock': 'var(--status-in-stock)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['var(--font-serif)', 'Cormorant Garamond', 'Georgia', 'serif'],
      },
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: 'var(--leading-normal)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--leading-normal)' }],
        base: ['var(--text-base)', { lineHeight: 'var(--leading-normal)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--leading-snug)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--leading-snug)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },
      spacing: {
        'sp-1': 'var(--space-1)',
        'sp-2': 'var(--space-2)',
        'sp-3': 'var(--space-3)',
        'sp-4': 'var(--space-4)',
        'sp-6': 'var(--space-6)',
        'sp-8': 'var(--space-8)',
        'sp-12': 'var(--space-12)',
        'sp-16': 'var(--space-16)',
      },
    },
  },
  plugins: [],
}
