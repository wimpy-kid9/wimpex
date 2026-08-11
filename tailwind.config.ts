import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0b0b0c',
        panel: '#131311',
        'panel-2': '#18170f',
        ivory: '#f0ebe0',
        slate: {
          DEFAULT: '#8a8478'
        },
        gold: {
          DEFAULT: '#c9a961',
          deep: '#8b6f3d'
        }
      },
      borderColor: {
        hairline: 'rgba(240,235,224,.14)',
        'hairline-strong': 'rgba(240,235,224,.26)'
      },
      fontFamily: {
        display: ['var(--font-display)', 'Bodoni Moda', 'serif'],
        body: ['var(--font-body)', 'Manrope', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
