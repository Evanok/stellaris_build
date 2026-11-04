import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { AuthProvider } from './AuthContext.tsx';
import { HelmetProvider } from 'react-helmet-async';

// Pages are lazy-loaded chunks. If one fails to download (network blip such as
// net::ERR_NETWORK_CHANGED, or a tab left open across a deploy whose old chunk
// hashes are gone), React gets a rejected import and renders a blank page.
// Vite fires 'vite:preloadError' in that case: reload once to recover. The
// timestamp guard prevents a reload loop when the asset is really unavailable.
const PRELOAD_RELOAD_KEY = 'preload-error-reload-at';
const PRELOAD_RELOAD_COOLDOWN_MS = 10000;
window.addEventListener('vite:preloadError', (event) => {
  try {
    const lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY)) || 0;
    if (Date.now() - lastReload < PRELOAD_RELOAD_COOLDOWN_MS) return; // already retried: let the error surface
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
  } catch {
    return; // no storage, no loop guard: do not risk a reload loop
  }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
