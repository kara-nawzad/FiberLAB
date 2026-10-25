import React from 'react';
import ReactDOM from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/theme.css';
import './styles/photo-ui.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const container = document.getElementById('root');
if (!container) {
  throw new Error('FiberLAB: root container #root was not found in the document.');
}

/* Boundaries only see render-time throws; pointer handlers, timers and promises
 * bypass them. Log those here so a field report is never silent. */
window.addEventListener('error', (event) => {
  console.error('FiberLAB runtime error:', event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('FiberLAB unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
