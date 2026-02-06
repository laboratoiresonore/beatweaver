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
        'beat-flash': 'beatFlash 0.15s ease-out',
        'vu-sim-1': 'vuSim1 1.2s ease-in-out infinite',
        'vu-sim-2': 'vuSim2 1.5s ease-in-out infinite',
        'vu-sim-3': 'vuSim3 0.9s ease-in-out infinite',
        'vu-sim-4': 'vuSim4 1.8s ease-in-out infinite',
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
        beatFlash: {
          '0%': { filter: 'brightness(2.5)', textShadow: '0 0 25px rgba(80, 180, 255, 0.9)' },
          '100%': { filter: 'brightness(1)', textShadow: '0 0 15px rgba(80, 180, 255, 0.08)' },
        },
        vuSim1: {
          '0%, 100%': { height: '40%' },
          '35%': { height: '90%' },
          '65%': { height: '55%' },
        },
        vuSim2: {
          '0%, 100%': { height: '30%' },
          '25%': { height: '70%' },
          '75%': { height: '85%' },
        },
        vuSim3: {
          '0%, 100%': { height: '60%' },
          '40%': { height: '95%' },
          '80%': { height: '35%' },
        },
        vuSim4: {
          '0%, 100%': { height: '25%' },
          '50%': { height: '75%' },
        },
      },
    },
  },
  plugins: [],
};
