/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // One restrained accent: a muted navy. Used for primary actions, links
        // and the active nav item, and nowhere else.
        accent: {
          50: '#f4f7fa',
          100: '#e6edf3',
          200: '#cbdae6',
          300: '#a3bdd1',
          400: '#7398b5',
          500: '#517ba0',
          600: '#3e6285',
          700: '#334f6b',
          800: '#2c435a',
          900: '#283a4d',
          950: '#1a2532',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      maxWidth: {
        prose: '68ch',
      },
      keyframes: {
        // The reveal used across the landing and auth pages. Short, eased out,
        // and small in distance: the point is to take the edge off an element
        // appearing, not to make the reader watch it arrive.
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        // `both` so a delayed element holds the `from` state until its turn
        // rather than flashing at full opacity first.
        'fade-up': 'fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 250ms ease-out both',
      },
    },
  },
  plugins: [],
}
