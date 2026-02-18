import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: Changed to named import because App component is exported as a constant in App.tsx
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);