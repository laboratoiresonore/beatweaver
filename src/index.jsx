import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Global error handlers to prevent black screen crashes
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Don't prevent default - let React ErrorBoundary handle it
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent the default behavior (which can crash Electron)
  event.preventDefault();
});

// StrictMode removed: it double-fires effects in dev mode which
// destroys Tone.js audio objects via singleton dispose(), breaking playback.
const root = createRoot(document.getElementById('root'));
root.render(<App />);
