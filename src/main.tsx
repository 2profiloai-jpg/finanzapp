import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

console.log("Main.tsx starting...");

const container = document.getElementById('root');
if (container) {
  console.log("Root container found, rendering...");
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  (window as any).__AUREUM_LOADED__ = true;
  console.log("Render called");
} else {
  console.error("Root container NOT found");
}
