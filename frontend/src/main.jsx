import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useUiStore } from './store/uiStore.js';

// Apply the saved / preferred theme before the first paint
document.documentElement.classList.toggle('dark', useUiStore.getState().theme === 'dark');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
