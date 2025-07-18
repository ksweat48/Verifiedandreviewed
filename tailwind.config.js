/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'cinzel': ['Cinzel', 'serif'],
        'poppins': ['Poppins', 'sans-serif'],
        'lora': ['Lora', 'serif'],
      },
      colors: {
        primary: {
          50: '#FFF5F4',
          100: '#FFE7E4',
          200: '#FFD4CE',
          300: '#FFB5AB',
          400: '#FF8A7A',
          500: '#f76c5e',
          600: '#E85A4A',
          700: '#D44A39',
          800: '#B23A2A',
          900: '#932F22',
        },
        accent: {
          50: '#F8F5FF',
          100: '#EDE5FF',
          200: '#DDD0FF',
          300: '#C4B0FF',
          400: '#A685FF',
          500: '#7b449b',
          600: '#6B3A85',
          700: '#5A3073',
          800: '#4A2762',
          900: '#3B1F51',
        },
        neutral: {
          50: '#F8F9FA',
          100: '#F1F3F4',
          200: '#E9ECEF',
          300: '#DEE2E6',
          400: '#CED4DA',
          500: '#ADB5BD',
          600: '#6C757D',
          700: '#495057',
          800: '#343A40',
          900: '#212529',
        }
      }
    },
  },
  plugins: [],
};