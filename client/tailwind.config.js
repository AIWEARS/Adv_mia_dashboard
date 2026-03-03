/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'mia-blue': '#2563eb',
        'mia-dark': '#0f172a',
        'mia-green': '#10b981',
        'mia-yellow': '#f59e0b',
        'mia-red': '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
