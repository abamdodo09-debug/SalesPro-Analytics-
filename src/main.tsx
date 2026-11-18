import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { FirebaseErrorBoundary } from './components/FirebaseErrorBoundary';
import './index.css';

// Tier 1 Google Maps auth / quota failure detection
const dispatchQuotaEvent = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

(window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
  dispatchQuotaEvent();
};

const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const joined = args.map((a) => (typeof a === 'string' ? a : String(a ?? ''))).join(' ');
  if (
    joined.includes('OverQuotaMapError') ||
    joined.includes('QuotaExceededError') ||
    joined.includes('RefererNotAllowedMapError') ||
    joined.includes('InvalidKeyMapError') ||
    joined.includes('ApiNotActivatedMapError')
  ) {
    dispatchQuotaEvent();
  }
  origConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <FirebaseErrorBoundary>
    <App />
  </FirebaseErrorBoundary>
);
