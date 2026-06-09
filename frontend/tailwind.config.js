/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: '#1a1d27',
        base: '#0f1117',
      },
      keyframes: {
        'plate-pop': {
          '0%': { opacity: '0', transform: 'scale(0.75)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'highlight-in': {
          '0%': { backgroundColor: 'rgba(34,197,94,0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'plate-pop': 'plate-pop 0.25s ease-out',
        'highlight-in': 'highlight-in 2s ease-out forwards',
      },
    },
  },
  plugins: [],
}
