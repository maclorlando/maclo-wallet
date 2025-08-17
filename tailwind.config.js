/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'jupiter-primary': 'rgb(var(--jupiter-primary))',
        'jupiter-secondary': 'rgb(var(--jupiter-secondary))',
        'jupiter-accent': 'rgb(var(--jupiter-accent))',
        'jupiter-success': 'rgb(var(--jupiter-success))',
        'jupiter-warning': 'rgb(var(--jupiter-warning))',
        'jupiter-error': 'rgb(var(--jupiter-error))',
        'foreground': 'rgb(var(--foreground-rgb))',
        'background-start': 'rgb(var(--background-start-rgb))',
        'background-end': 'rgb(var(--background-end-rgb))',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}

