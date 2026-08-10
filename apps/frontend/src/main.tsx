import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeTelegramApp } from '@/lib/telegram';
import './index.css';

// Initialize Telegram Mini App SDK
initializeTelegramApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
