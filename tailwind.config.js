/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Paper tones
        paper: {
          light: 'var(--paper-light)',
          mid: 'var(--paper-mid)',
          DEFAULT: 'var(--paper-mid)',
          dark: 'var(--paper-dark)',
        },
        // Accent colors
        terracotta: {
          DEFAULT: 'var(--terracotta)',
          dark: 'var(--terracotta-dark)',
        },
        // Text colors
        charcoal: 'var(--charcoal)',
        'warm-gray': 'var(--warm-gray)',
        // Semantic colors (reference CSS variables)
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
        // Status indicator colors
        status: {
          read: 'var(--status-read)',
          owned: 'var(--status-owned)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['var(--font-serif)', 'Lora', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
}
