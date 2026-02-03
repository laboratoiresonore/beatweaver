/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // DJ-friendly dark theme
        'dj-bg': '#0a0a0a',
        'dj-surface': '#141414',
        'dj-border': '#2a2a2a',
        'dj-accent': '#00ff88', // Neon green for locked/active
        'dj-warning': '#ffaa00', // Amber for analyzing
        'dj-error': '#ff4444', // Red for errors
        'dj-muted': '#666666',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00ff88, 0 0 10px #00ff88' },
          '100%': { boxShadow: '0 0 10px #00ff88, 0 0 20px #00ff88, 0 0 30px #00ff88' },
        },
      },
    },
  },
  plugins: [],
};
