import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        colorScheme?: 'light' | 'dark';
        onEvent?: (event: string, callback: () => void) => void;
      };
    };
  }
}

function applyTheme() {
  const tg = window.Telegram?.WebApp;
  const isDark = tg?.colorScheme === 'dark' ||
    (!tg?.colorScheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  document.documentElement.classList.toggle('dark', isDark);
}

applyTheme();

window.Telegram?.WebApp?.onEvent?.('themeChanged', applyTheme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
