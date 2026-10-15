import React from 'react';
import ReactDOM from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './index.css';
import './fiberlab-theme.css';
import './photo-ui.css';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('FiberLAB: root container #root was not found in the document.');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
