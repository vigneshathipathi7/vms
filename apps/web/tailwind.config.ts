import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        redZone: '#ef4444',
        greenZone: '#22c55e',
        orangeZone: '#f97316',
      },
    },
  },
  plugins: [],
};

export default config;
