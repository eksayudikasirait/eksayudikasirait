import {createRoot} from 'react-dom/client';
import {setLogLevel} from 'firebase/firestore';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registrasi Service Worker PWA untuk Offline Caching & Akses Mandiri
try {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Pembaruan service worker otomatis
    },
    onOfflineReady() {
      console.log('Aplikasi ANBK Informatika UPTD SMPN 7 Kisaran siap digunakan dalam mode offline!');
    },
  });
} catch {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    });
  }
}

try {
  setLogLevel('silent');
} catch {
  // ignore
}

(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const isIgnorableRuntimeLog = (msg: string): boolean =>
  msg.includes('WebSocket closed without opened') ||
  msg.includes('failed to connect to websocket') ||
  msg.includes('[vite]') ||
  msg.includes('@vite/client') ||
  msg.includes('@firebase/firestore') ||
  msg.includes('Could not reach Cloud Firestore backend') ||
  msg.includes('operate in offline mode') ||
  msg.includes('[code=unavailable]') ||
  msg.includes('auth/popup-closed-by-user') ||
  msg.includes('auth/cancelled-popup-request') ||
  msg.includes('auth/popup-blocked') ||
  msg.includes('auth/unauthorized-domain') ||
  msg.includes('Sign in error:') ||
  msg.includes('ResizeObserver') ||
  msg.includes('Permissions check failed') ||
  msg.includes('API can only be initiated by a user gesture') ||
  msg.includes('requestFullscreen') ||
  msg.includes('interrupted by a call to pause') ||
  msg.includes('interrupted by a new load request') ||
  msg.includes('OverQuotaMapError') ||
  msg.includes('QuotaExceededError') ||
  msg.includes('cannotExportFile') ||
  msg.includes('cannot be exported by the user') ||
  msg.trim() === 'Script error.' ||
  msg.trim() === 'Script error';

window.addEventListener(
  'error',
  (event) => {
    const msg = String(event.message || '');
    if (isIgnorableRuntimeLog(msg) || (!event.filename && !event.lineno)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true
);

window.addEventListener(
  'unhandledrejection',
  (event) => {
    const reasonStr = String(
      (event.reason as {message?: string; code?: string})?.message ||
        (event.reason as {code?: string})?.code ||
        event.reason ||
        ''
    );
    if (isIgnorableRuntimeLog(reasonStr)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true
);

const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String((a as {message?: string})?.message || a)).join(' ');
  if (isIgnorableRuntimeLog(msg)) {
    return;
  }
  origError.apply(console, args);
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = args.map((a) => String((a as {message?: string})?.message || a)).join(' ');
  if (isIgnorableRuntimeLog(msg)) {
    return;
  }
  origWarn.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);

