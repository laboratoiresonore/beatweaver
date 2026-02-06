/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Pioneer DJ Pro dark theme
        'dj-bg': '#08080c',
        'dj-surface': '#121218',
        'dj-surface-raised': '#1a1a22',
        'dj-border': '#1e1e28',
        'dj-border-strong': '#2a2a32',
        'dj-accent': '#50B4FF',       // rekordbox 7 sky blue
        'dj-accent-deep': '#305AFF',  // Pioneer deep blue
        'dj-warning': '#FFA600',      // Pioneer amber
        'dj-error': '#E62828',        // Pioneer red
        'dj-muted': '#6b6b78',
        'dj-text': '#e0e0e8',
        'dj-text-secondary': '#9e9ea8',
        // Pioneer status colors
        'dj-green': '#00C853',
        'dj-amber': '#FFB300',
        'dj-orange': '#FF6D00',
        'dj-red': '#FF1744',
        'dj-pink': '#FF127B',
        'dj-purple': '#B432FF',
        'dj-cyan': '#00E0FF',
      },
      fontFamily: {
        'display': ['"JetBrains Mono"', '"Roboto Mono"', '"SF Mono"', 'monospace'],
        'ui': ['Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'active-pulse': 'activePulse 4s ease-in-out infinite',
        'led-breathe': 'ledBreathe 2s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 4px var(--glow-color, #50B4FF), 0 0 8px var(--glow-color, #50B4FF)' },
          '100%': { boxShadow: '0 0 8px var(--glow-color, #50B4FF), 0 0 16px var(--glow-color, #50B4FF), 0 0 24px var(--glow-color, #50B4FF)' },
        },
        activePulse: {
          '0%, 100%': { color: '#e0e0e8' },
          '50%': { color: '#50B4FF' },
        },
        ledBreathe: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
