import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler for debugging white screen
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global JS Error:", { message, source, lineno, colno, error });
  const root = document.getElementById('root');
  if (root && root.innerHTML === "") {
    root.innerHTML = `<div style="padding: 20px; color: white; background: black; font-family: sans-serif;">
      <h2>Errore di caricamento</h2>
      <p>${message}</p>
      <button onclick="location.reload()" style="padding: 10px; background: #D4AF37; border: none; border-radius: 5px; color: black;">Ricarica App</button>
    </div>`;
  }
};

// Temporarily disable service worker to debug white screen
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service worker registration failed: ', err);
    });
  });
}
*/

const container = document.getElementById('root');
if (!container) {
  throw new Error("Elemento 'root' non trovato nel DOM.");
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
