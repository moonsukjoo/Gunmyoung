import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const RELOAD_GUARD_KEY = 'boot_chunk_reload_at';

function tryGuardedReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
    const now = Date.now();
    if (!last || now - last > 15000) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
      window.location.reload();
      return true;
    }
  } catch {
    // ignore storage restriction
  }
  return false;
}

function renderBootRecovery(title: string, detail?: string) {
  const existing = document.getElementById('boot-recovery-overlay');
  if (existing) return;
  const el = document.createElement('div');
  el.id = 'boot-recovery-overlay';
  el.style.cssText =
    'position:fixed;inset:0;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;padding:24px;z-index:99999;font-family:system-ui,-apple-system,sans-serif;';
  el.innerHTML = `
    <div style="max-width:420px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;box-shadow:0 20px 50px rgba(15,23,42,0.12);text-align:center;">
      <h2 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#0f172a;">${title}</h2>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#475569;word-break:break-word;">${detail || '네트워크 또는 캐시 갱신 중 화면을 불러오지 못했습니다.'}</p>
      <button id="boot-recovery-btn" style="width:100%;padding:12px 18px;background:#2563eb;color:#ffffff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">새로고침 (다시 불러오기)</button>
    </div>
  `;
  document.body.appendChild(el);
  const btn = document.getElementById('boot-recovery-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      try { sessionStorage.removeItem(RELOAD_GUARD_KEY); } catch {}
      window.location.reload();
    });
  }
}

window.addEventListener('vite:preloadError', (event: Event) => {
  event.preventDefault();
  if (!tryGuardedReload()) {
    renderBootRecovery('최신 화면 모듈을 불러오지 못했습니다', '서버가 재시작되었거나 캐시가 변경되었습니다. 아래 버튼을 눌러 새로고침해 주세요.');
  }
});

window.addEventListener('error', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
    const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || '';
    if (src && !tryGuardedReload()) {
      const root = document.getElementById('root');
      if (!root || root.children.length === 0) {
        renderBootRecovery('리소스 로드 오류', `스크립트 또는 스타일을 불러오지 못했습니다: ${src}`);
      }
    }
  }
}, true);

// Global error handling for debugging and preventing blank white screens
window.onerror = (message, source, lineno, colno, error) => {
  const msgStr = typeof message === 'string' ? message : String(message || '');
  if (msgStr.includes('ResizeObserver')) {
    return true;
  }
  const isModuleOrChunkErr =
    msgStr.includes('Loading chunk') ||
    msgStr.includes('Failed to fetch dynamically imported module') ||
    msgStr.includes('Importing a module script failed') ||
    msgStr.includes('Script error');

  const root = document.getElementById('root');
  if (isModuleOrChunkErr) {
    if (!root || root.children.length === 0) {
      if (!tryGuardedReload()) {
        renderBootRecovery('화면 모듈 로드 실패', msgStr);
      }
    }
    return true;
  }

  console.error("FATAL ERROR caught:", {message, source, lineno, colno, error});
  if (!root || root.children.length === 0) {
    renderBootRecovery(
      '런타임 오류가 발생했습니다',
      `${msgStr}${source ? ` (${source}:${lineno}:${colno})` : ''}`
    );
  }
};

window.onunhandledrejection = (event) => {
  if (!event.reason) {
    event.preventDefault();
    return;
  }
  const reasonStr = String(event.reason?.message || event.reason || '');
  if (
    reasonStr.includes('ResizeObserver') ||
    reasonStr.includes('cancelled') ||
    reasonStr.includes('canceled') ||
    reasonStr.includes('AbortError') ||
    reasonStr.includes('User denied Geolocation')
  ) {
    event.preventDefault();
    return;
  }
  const isDynamicImportError =
    reasonStr.includes('Failed to fetch dynamically imported module') ||
    reasonStr.includes('Importing a module script failed') ||
    reasonStr.includes('Outdated Optimize Dep');
  const root = document.getElementById('root');
  if (isDynamicImportError && (!root || root.children.length === 0)) {
    if (!tryGuardedReload()) {
      renderBootRecovery('최신 모듈 동기화 필요', reasonStr);
    }
    event.preventDefault();
    return;
  }
  console.warn("UNHANDLED REJECTION caught:", event.reason);
  event.preventDefault();
};

const container = document.getElementById('root');
if (!container) {
  console.error("CRITICAL: Root element #root not found!");
  renderBootRecovery('초기화 오류', '#root 컨테이너를 찾을 수 없습니다.');
} else {
  try {
    const root = createRoot(container);
    root.render(<App />);
    (window as any).__APP_BOOT_MOUNTED__ = true;
    if ((window as any).__APP_BOOT_WATCHDOG__) {
      clearTimeout((window as any).__APP_BOOT_WATCHDOG__);
    }
    const existingOverlay = document.getElementById('boot-recovery-overlay');
    if (existingOverlay) existingOverlay.remove();
  } catch (err: any) {
    console.error("CRITICAL: React initialization failed:", err);
    renderBootRecovery('앱 초기화 실패', err?.message || String(err));
  }
}
