import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './tailwind.css';
import './styles/community.css';
import './styles/controls.css';
import './styles/media.css';
import { initializeTheme } from './store/preferencesStore';
const stopTheme = initializeTheme();
if (import.meta.hot) import.meta.hot.dispose(stopTheme);

const isPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

if (isPreview) {
  import('./data/previewApi').then(({ installPreviewApi }) => {
    installPreviewApi();
    renderApp();
  });
} else {
  renderApp();
}
