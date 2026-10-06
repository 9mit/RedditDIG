import React from 'react';
import ReactDOM from 'react-dom/client';
import { Sidepanel } from './Sidepanel';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <Sidepanel />
    </React.StrictMode>
  );
}
