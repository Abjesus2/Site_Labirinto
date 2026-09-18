import {installEmbedCompat} from './lib/embedCompat';
import {installAIBridge} from './lib/aiBrowserBridge';

try { installEmbedCompat(); } catch (e) { console.error('Falha na camada de compatibilidade', e); }
try { installAIBridge(); } catch (e) { console.error('Falha ao instalar ponte de IA', e); }

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const isResizeObserverError = (msg: unknown) => {
  if (typeof msg === 'string') {
    return (
      msg.includes('ResizeObserver loop completed with undelivered notifications') ||
      msg.includes('ResizeObserver loop limit exceeded') ||
      msg.includes('ResizeObserver')
    );
  }
  return false;
};

const originalError = console.error;
console.error = (...args) => {
  if (isResizeObserverError(args[0]) || (args[0] && typeof args[0] === 'object' && isResizeObserverError((args[0] as any).message))) {
    return;
  }
  originalError(...args);
};

const originalWarn = console.warn;
console.warn = (...args) => {
  if (isResizeObserverError(args[0]) || (args[0] && typeof args[0] === 'object' && isResizeObserverError((args[0] as any).message))) {
    return;
  }
  originalWarn(...args);
};

window.addEventListener('error', (e) => {
  if (isResizeObserverError(e.message) || isResizeObserverError(e.error?.message)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  if (isResizeObserverError(e.reason) || isResizeObserverError(e.reason?.message)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
