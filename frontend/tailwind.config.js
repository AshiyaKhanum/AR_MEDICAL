/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effefb',
          100: '#c7fdf2',
          200: '#90fae6',
          300: '#53efd6',
          400: '#22d8c1',
          500: '#0abcaa',
          600: '#04968c',
          700: '#0f766e',
          800: '#115e58',
          900: '#134e49',
          950: '#042f2c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
};
