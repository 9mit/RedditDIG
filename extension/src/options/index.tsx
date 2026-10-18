import React from 'react';
import ReactDOM from 'react-dom/client';
import { Options } from './Options';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>
  );
}
