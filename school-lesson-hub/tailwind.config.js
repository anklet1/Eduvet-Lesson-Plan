/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./eduvet-school-hub-enhanced.html",
    "./public/**/*.html",
    "./dist/**/*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gesNavy: '#0F2942',
        gesBlue: '#1A73E8',
        gesGold: '#D97706',
        gesGreen: '#059669',
        gesRed: '#DC2626',
        paystackBlue: '#011B33',
        eduvetBlue: '#0A2540',
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#38a8f8',
          500: '#0e8ce9',
          600: '#026fc7',
          700: '#0358a1',
          800: '#074b84',
          900: '#0c3f6e',
          950: '#082849',
        },
        navy: {
          800: '#141e33',
          900: '#0f172a',
          950: '#0a0f1d'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
