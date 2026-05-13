import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log("App booting - Entry point main.tsx reached");

// Global error handling for debugging white screen
window.onerror = (message, source, lineno, colno, error) => {
  console.error("FATAL ERROR caught:", {message, source, lineno, colno, error});
  const root = document.getElementById('root');
  const errorContainer = document.createElement('div');
  errorContainer.style.cssText = "position:fixed; inset:20px; background:#821; color:white; padding:20px; z-index:99999; font-family:sans-serif; border-radius:10px; overflow:auto;";
  errorContainer.innerHTML = `
    <h2 style="margin-top:0">런타임 오류가 발생했습니다</h2>
    <p><strong>오류 메시지:</strong> ${message}</p>
    <p><strong>소스:</strong> ${source}:${lineno}:${colno}</p>
    <pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; font-size:12px;">${error?.stack || 'Stack trace not available'}</pre>
    <button onclick="location.reload()" style="padding:12px 24px; background:white; color:black; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:10px;">다시 시도 (새로고침)</button>
  `;
  document.body.appendChild(errorContainer);
};

window.onunhandledrejection = (event) => {
  console.error("UNHANDLED REJECTION caught:", event.reason);
};

console.log("Locating root element...");
const container = document.getElementById('root');
if (!container) {
  console.error("CRITICAL: Root element #root not found!");
  document.body.innerHTML = '<div style="color:red; padding:20px; font-weight:bold;">Error: #root element not found in index.html</div>';
} else {
  console.log("Root element found, initializing React...");
  try {
    const root = createRoot(container);
    root.render(<App />);
    console.log("React render call completed");
  } catch (err) {
    console.error("CRITICAL: React initialization failed:", err);
    throw err; // Trigger window.onerror
  }
}
