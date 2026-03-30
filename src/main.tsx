import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler for debugging white screen
console.log("Main.tsx loading...");

window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global JS Error:", { message, source, lineno, colno, error });
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: white; background: #000; font-family: sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
      <h2 style="color: #D4AF37;">Errore di caricamento</h2>
      <p style="opacity: 0.7; max-width: 400px; margin: 20px 0;">${message}</p>
      <div style="font-size: 10px; opacity: 0.5; margin-bottom: 20px;">${source}:${lineno}:${colno}</div>
      <button onclick="location.reload()" style="padding: 12px 24px; background: #D4AF37; border: none; border-radius: 8px; color: black; font-weight: bold; cursor: pointer;">Ricarica App</button>
    </div>`;
  }
};

window.onunhandledrejection = function(event) {
  console.error("Unhandled Promise Rejection:", event.reason);
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
  console.error("Root container not found");
  throw new Error("Elemento 'root' non trovato nel DOM.");
}

console.log("Rendering app...");
const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
(window as any).AUREUM_LOADED = true;
console.log("App mounted successfully");
