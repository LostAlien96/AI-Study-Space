/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        surface: {
          950: '#030712',
          900: '#0B0F19',
          850: '#111827',
          800: '#1F2937',
          700: '#374151',
        },
        accent: {
          cyan: '#06B6D4',
          sky: '#0EA5E9',
          indigo: '#6366F1',
          violet: '#8B5CF6',
        }
      }
    },
  },
  plugins: [],
}
