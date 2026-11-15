import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#080910',
        surface: {
          DEFAULT: '#111321',
          light: '#16192E',
          card: '#131527',
        },
        secondary: {
          DEFAULT: '#191B2D',
          hover: '#22253D',
        },
        border: {
          DEFAULT: '#232742',
          subtle: '#1A1D33',
          active: '#3B426B',
        },
        accent: {
          purple: {
            DEFAULT: '#8B5CF6',
            hover: '#7C3AED',
            light: '#A78BFA',
            dark: '#6D28D9',
            glow: 'rgba(139, 92, 246, 0.25)',
          },
          cyan: {
            DEFAULT: '#22D3EE',
            hover: '#06B6D4',
            light: '#67E8F9',
            dark: '#0891B2',
            glow: 'rgba(34, 211, 238, 0.25)',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
