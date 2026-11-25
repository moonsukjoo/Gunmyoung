import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { db, auth } from '@/firebase';
import { doc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/errorHandlers';

export interface AppVersionInfo {
  versionCode: number;
  versionName: string;
  packageName: string;
  isNativeAndroid: boolean;
}

export interface AppUpdateSettings {
  latestVersionCode: number;
  latestVersionName: string;
  apkUrl: string;
  githubRepo?: string;
  releaseNotes?: string;
  forceUpdate?: boolean;
  autoCheckEnabled?: boolean;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface ServerVersionCandidate {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  updatedAt?: string;
  source?: 'firestore' | 'github' | 'web_bundle';
}

export interface LocalVersionSnapshot {
  versionCode: number;
  versionName: string;
  packageName: string;
  isNativeAndroid: boolean;
  buildAt?: string;
  appliedUpdatedAt?: string;
  acknowledgedSignature?: string;
}

export type VersionCompareReason =
  | 'VERSION_CODE'
  | 'VERSION_NAME'
  | 'SERVER_TIMESTAMP'
  | 'WEB_BUNDLE'
  | 'UP_TO_DATE';

export type UpdateKind = 'MAJOR' | 'MINOR' | 'PATCH' | 'SERVER_SYNC' | 'NONE';

export interface VersionComparisonResult {
  needsUpdate: boolean;
  requiresApkDownload: boolean;
  reason: VersionCompareReason;
  updateType: UpdateKind;
  updateTypeLabel: string;
  localVersionCode: number;
  localVersionName: string;
  serverVersionCode: number;
  serverVersionName: string;
  localTimestamp?: string;
  serverTimestamp?: string;
  summary: string;
}

export interface DownloadProgressEvent {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

interface AppUpdaterPlugin {
  getAppVersion(): Promise<{ versionCode: number; versionName: string; packageName: string }>;
  canInstallPackages(): Promise<{ granted: boolean }>;
  openInstallPermissionSettings(): Promise<{ granted: boolean }>;
  downloadAndInstallApk(options: {
    url: string;
    versionName?: string;
  }): Promise<{ started: boolean; needsPermission?: boolean; versionName?: string; filePath?: string }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: DownloadProgressEvent) => void
  ): Promise<PluginListenerHandle>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export const DEFAULT_GITHUB_REPO = 'moonsukjoo/Gunmyoung';
export const DEFAULT_APK_URL = `https://github.com/${DEFAULT_GITHUB_REPO}/releases/latest/download/gunyoung-hrm-latest.apk`;

const LOCAL_VERSION_STORAGE_KEY = 'gunmyoung_local_app_version_v1';

export const DEFAULT_APP_UPDATE_SETTINGS: AppUpdateSettings = {
  latestVersionCode: 100,
  latestVersionName: '1.0.0',
  apkUrl: DEFAULT_APK_URL,
  githubRepo: DEFAULT_GITHUB_REPO,
  releaseNotes: '',
  forceUpdate: false,
  autoCheckEnabled: true,
};

export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function getWebBuildTimestamp(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env?.VITE_APP_BUILD_AT;
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? raw : undefined;
}

export function getSavedLocalVersionRecord(): {
  versionCode?: number;
  versionName?: string;
  appliedUpdatedAt?: string;
  acknowledgedSignature?: string;
} | null {
  try {
    const raw = localStorage.getItem(LOCAL_VERSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAppliedVersionSnapshot(snapshot: {
  versionCode: number;
  versionName: string;
  updatedAt?: string;
  signature?: string;
}): void {
  try {
    localStorage.setItem(
      LOCAL_VERSION_STORAGE_KEY,
      JSON.stringify({
        versionCode: Number(snapshot.versionCode) || 0,
        versionName: String(snapshot.versionName || ''),
        appliedUpdatedAt: snapshot.updatedAt || new Date().toISOString(),
        acknowledgedSignature: snapshot.signature || '',
        savedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn('Failed to persist applied app version snapshot:', err);
  }
}

export async function getInstalledAppVersion(): Promise<AppVersionInfo> {
  if (!isNativeAndroidApp()) {
    const saved = getSavedLocalVersionRecord();
    return {
      versionCode: Number(saved?.versionCode) || 0,
      versionName: saved?.versionName || 'Web/PWA',
      packageName: 'com.gunmyoung.app',
      isNativeAndroid: false,
    };
  }
  try {
    const info = await AppUpdater.getAppVersion();
    return {
      versionCode: Number(info.versionCode) || 1,
      versionName: info.versionName || '1.0.0',
      packageName: info.packageName || 'com.gunmyoung.app',
      isNativeAndroid: true,
    };
  } catch (error) {
    console.warn('AppUpdater.getAppVersion failed (older APK build without AppUpdaterPlugin):', error);
    return {
      versionCode: 1,
      versionName: '구버전 APK',
      packageName: 'com.gunmyoung.app',
      isNativeAndroid: true,
    };
  }
}

export async function getLocalVersionSnapshot(): Promise<LocalVersionSnapshot> {
  const base = await getInstalledAppVersion();
  const saved = getSavedLocalVersionRecord();
  return {
    ...base,
    buildAt: getWebBuildTimestamp(),
    appliedUpdatedAt: saved?.appliedUpdatedAt,
    acknowledgedSignature: saved?.acknowledgedSignature,
  };
}

export interface ParsedSemver {
  parts: number[];
  prerelease: string | null;
  valid: boolean;
}

export function parseSemanticVersion(versionName: string): ParsedSemver {
  const cleaned = String(versionName || '')
    .trim()
    .replace(/^v/i, '');
  if (!cleaned) {
    return { parts: [], prerelease: null, valid: false };
  }

  const [corePart, prePart] = cleaned.split('-', 2);
  if (!/^\d+(\.\d+)*$/.test(corePart)) {
    return { parts: [], prerelease: null, valid: false };
  }

  const parts = corePart.split('.').map((seg) => Number.parseInt(seg, 10));
  if (parts.some((n) => !Number.isFinite(n))) {
    return { parts: [], prerelease: null, valid: false };
  }

  while (parts.length < 3) {
    parts.push(0);
  }

  return {
    parts,
    prerelease: prePart ? prePart.trim() : null,
    valid: true,
  };
}

/**
 * Compares two version strings semantically.
 * Returns 1 if a > b, -1 if a < b, 0 if equal (or incomparable).
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemanticVersion(a);
  const pb = parseSemanticVersion(b);
  if (!pa.valid || !pb.valid) return 0;

  const maxLen = Math.max(pa.parts.length, pb.parts.length);
  for (let i = 0; i < maxLen; i++) {
    const va = pa.parts[i] ?? 0;
    const vb = pb.parts[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }

  // Stable release > pre-release (e.g., 1.0.0 > 1.0.0-beta.1)
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && !pb.prerelease) return -1;
  if (pa.prerelease && pb.prerelease && pa.prerelease !== pb.prerelease) {
    return pa.prerelease.localeCompare(pb.prerelease, undefined, { numeric: true }) > 0 ? 1 : -1;
  }

  return 0;
}

function classifySemverUpdate(localName: string, serverName: string): UpdateKind {
  const localParsed = parseSemanticVersion(localName);
  const serverParsed = parseSemanticVersion(serverName);
  if (!localParsed.valid || !serverParsed.valid) return 'PATCH';
  if ((serverParsed.parts[0] ?? 0) > (localParsed.parts[0] ?? 0)) return 'MAJOR';
  if ((serverParsed.parts[1] ?? 0) > (localParsed.parts[1] ?? 0)) return 'MINOR';
  return 'PATCH';
}

function getUpdateTypeLabel(kind: UpdateKind): string {
  switch (kind) {
    case 'MAJOR':
      return '주요 버전 업데이트';
    case 'MINOR':
      return '기능 업데이트';
    case 'PATCH':
      return '개선·버그 수정';
    case 'SERVER_SYNC':
      return '최신 화면·설정 반영';
    default:
      return '최신 버전';
  }
}

export function buildVersionSignature(server: {
  versionCode: number;
  versionName: string;
  updatedAt?: string;
}): string {
  return `${server.versionCode}|${server.versionName}|${server.updatedAt || ''}`;
}

/**
 * Fine-grained comparison between local installed/session state and Firestore/server version metadata.
 * Checks integer versionCode, semantic versionName (major.minor.patch), and server updatedAt timestamps.
 */
export function compareVersionsDetailed(
  local: LocalVersionSnapshot,
  server: ServerVersionCandidate,
  options?: { webBundleChanged?: boolean; sessionBootAtMs?: number }
): VersionComparisonResult {
  const localCode = Number(local.versionCode) || 0;
  const serverCode = Number(server.versionCode) || 0;
  const localName = local.versionName || (local.isNativeAndroid ? '1.0.0' : 'Web/PWA');
  const serverName = server.versionName || `1.0.${serverCode}`;

  const serverUpdatedMs = server.updatedAt ? Date.parse(server.updatedAt) : NaN;
  const appliedUpdatedMs = local.appliedUpdatedAt ? Date.parse(local.appliedUpdatedAt) : NaN;
  const buildAtMs = local.buildAt ? Date.parse(local.buildAt) : NaN;
  const sig = buildVersionSignature(server);
  const isSignatureAlreadyApplied = !!local.acknowledgedSignature && local.acknowledgedSignature === sig;

  // 1. Web bundle change detected directly from server index.html script assets
  if (!local.isNativeAndroid && options?.webBundleChanged) {
    return {
      needsUpdate: true,
      requiresApkDownload: false,
      reason: 'WEB_BUNDLE',
      updateType: 'SERVER_SYNC',
      updateTypeLabel: getUpdateTypeLabel('SERVER_SYNC'),
      localVersionCode: localCode,
      localVersionName: localName,
      serverVersionCode: serverCode,
      serverVersionName: serverName,
      localTimestamp: local.appliedUpdatedAt || local.buildAt,
      serverTimestamp: server.updatedAt,
      summary: '서버에 새로운 웹 화면 리소스가 배포되었습니다.',
    };
  }

  // 2. Native Android comparison
  if (local.isNativeAndroid) {
    if (serverCode > localCode) {
      const kind = classifySemverUpdate(localName, serverName);
      return {
        needsUpdate: true,
        requiresApkDownload: true,
        reason: 'VERSION_CODE',
        updateType: kind,
        updateTypeLabel: getUpdateTypeLabel(kind),
        localVersionCode: localCode,
        localVersionName: localName,
        serverVersionCode: serverCode,
        serverVersionName: serverName,
        localTimestamp: local.appliedUpdatedAt,
        serverTimestamp: server.updatedAt,
        summary: `로컬 v${localName} (코드 ${localCode}) → 서버 v${serverName} (코드 ${serverCode})`,
      };
    }

    const semverDiff = compareSemver(serverName, localName);
    if (semverDiff > 0 && serverCode >= localCode) {
      const kind = classifySemverUpdate(localName, serverName);
      return {
        needsUpdate: true,
        requiresApkDownload: true,
        reason: 'VERSION_NAME',
        updateType: kind,
        updateTypeLabel: getUpdateTypeLabel(kind),
        localVersionCode: localCode,
        localVersionName: localName,
        serverVersionCode: serverCode,
        serverVersionName: serverName,
        localTimestamp: local.appliedUpdatedAt,
        serverTimestamp: server.updatedAt,
        summary: `버전 문자열이 더 최신입니다 (로컬 v${localName} → 서버 v${serverName})`,
      };
    }

    // Same APK version, check if Firestore metadata was pushed live during this session
    if (
      Number.isFinite(serverUpdatedMs) &&
      !isSignatureAlreadyApplied &&
      ((Number.isFinite(appliedUpdatedMs) && serverUpdatedMs > appliedUpdatedMs + 2000) ||
        (options?.sessionBootAtMs && serverUpdatedMs > options.sessionBootAtMs + 2000))
    ) {
      return {
        needsUpdate: true,
        requiresApkDownload: false,
        reason: 'SERVER_TIMESTAMP',
        updateType: 'SERVER_SYNC',
        updateTypeLabel: getUpdateTypeLabel('SERVER_SYNC'),
        localVersionCode: localCode,
        localVersionName: localName,
        serverVersionCode: serverCode,
        serverVersionName: serverName,
        localTimestamp: local.appliedUpdatedAt,
        serverTimestamp: server.updatedAt,
        summary: '앱 재설치 없이 반영 가능한 최신 서버 업데이트가 있습니다.',
      };
    }

    return {
      needsUpdate: false,
      requiresApkDownload: false,
      reason: 'UP_TO_DATE',
      updateType: 'NONE',
      updateTypeLabel: getUpdateTypeLabel('NONE'),
      localVersionCode: localCode,
      localVersionName: localName,
      serverVersionCode: serverCode,
      serverVersionName: serverName,
      localTimestamp: local.appliedUpdatedAt,
      serverTimestamp: server.updatedAt,
      summary: `현재 최신 버전(v${localName}, 코드 ${localCode})을 사용 중입니다.`,
    };
  }

  // 3. Web / PWA comparison against Firestore settings/app_update
  if (localCode > 0) {
    if (serverCode > localCode) {
      const kind = classifySemverUpdate(localName, serverName);
      return {
        needsUpdate: true,
        requiresApkDownload: false,
        reason: 'VERSION_CODE',
        updateType: kind,
        updateTypeLabel: getUpdateTypeLabel(kind),
        localVersionCode: localCode,
        localVersionName: localName,
        serverVersionCode: serverCode,
        serverVersionName: serverName,
        localTimestamp: local.appliedUpdatedAt || local.buildAt,
        serverTimestamp: server.updatedAt,
        summary: `로컬 v${localName} (코드 ${localCode}) → 서버 v${serverName} (코드 ${serverCode})`,
      };
    }

    const semverDiff = compareSemver(serverName, localName);
    if (semverDiff > 0) {
      const kind = classifySemverUpdate(localName, serverName);
      return {
        needsUpdate: true,
        requiresApkDownload: false,
        reason: 'VERSION_NAME',
        updateType: kind,
        updateTypeLabel: getUpdateTypeLabel(kind),
        localVersionCode: localCode,
        localVersionName: localName,
        serverVersionCode: serverCode,
        serverVersionName: serverName,
        localTimestamp: local.appliedUpdatedAt || local.buildAt,
        serverTimestamp: server.updatedAt,
        summary: `서버 버전이 더 최신입니다 (로컬 v${localName} → 서버 v${serverName})`,
      };
    }
  }

  const baselineMs = Math.max(
    Number.isFinite(appliedUpdatedMs) ? appliedUpdatedMs : 0,
    Number.isFinite(buildAtMs) ? buildAtMs : 0
  );

  if (
    Number.isFinite(serverUpdatedMs) &&
    baselineMs > 0 &&
    serverUpdatedMs > baselineMs + 5000 &&
    !isSignatureAlreadyApplied
  ) {
    return {
      needsUpdate: true,
      requiresApkDownload: false,
      reason: 'SERVER_TIMESTAMP',
      updateType: 'SERVER_SYNC',
      updateTypeLabel: getUpdateTypeLabel('SERVER_SYNC'),
      localVersionCode: localCode,
      localVersionName: localName,
      serverVersionCode: serverCode,
      serverVersionName: serverName,
      localTimestamp: local.appliedUpdatedAt || local.buildAt,
      serverTimestamp: server.updatedAt,
      summary: `서버에 새로운 업데이트(v${serverName})가 등록되었습니다.`,
    };
  }

  return {
    needsUpdate: false,
    requiresApkDownload: false,
    reason: 'UP_TO_DATE',
    updateType: 'NONE',
    updateTypeLabel: getUpdateTypeLabel('NONE'),
    localVersionCode: localCode,
    localVersionName: localName,
    serverVersionCode: serverCode,
    serverVersionName: serverName,
    localTimestamp: local.appliedUpdatedAt || local.buildAt,
    serverTimestamp: server.updatedAt,
    summary: `웹 버전이 최신 상태(v${serverName})입니다.`,
  };
}

/**
 * Checks whether the deployed web index.html references newer module bundles than the active document.
 */
export async function checkWebBundleChanged(): Promise<boolean> {
  if (isNativeAndroidApp() || typeof document === 'undefined') return false;
  try {
    const currentScripts = Array.from(document.querySelectorAll('script[type="module"][src]'))
      .map((el) => el.getAttribute('src') || '')
      .filter((src) => src.includes('/assets/'));

    // In local Vite dev mode (/src/main.tsx), /assets/ hashed bundles aren't used
    if (currentScripts.length === 0) return false;

    const resp = await fetch(`${window.location.origin}/index.html?_ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'text/html' },
    });
    if (!resp.ok) return false;
    const html = await resp.text();
    const matches = Array.from(html.matchAll(/src="([^"]*\/assets\/[^"]+\.js)"/g)).map((m) => m[1]);
    if (matches.length === 0) return false;

    const currentSet = new Set(currentScripts);
    return matches.some((src) => !currentSet.has(src));
  } catch {
    return false;
  }
}

/**
 * Applies a Web/PWA update gracefully ONLY when triggered by the user clicking '업데이트 반영'.
 */
export async function applyWebUpdateSmoothly(server?: {
  versionCode: number;
  versionName: string;
  updatedAt?: string;
}): Promise<void> {
  if (server) {
    saveAppliedVersionSnapshot({
      versionCode: server.versionCode,
      versionName: server.versionName,
      updatedAt: server.updatedAt,
      signature: buildVersionSignature(server),
    });
  }

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch (err) {
    console.warn('Cache cleanup skipped:', err);
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await reg.update().catch(() => {});
        })
      );
    }
  } catch (err) {
    console.warn('ServiceWorker refresh skipped:', err);
  }

  window.location.reload();
}

export async function canInstallApkPackages(): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;
  try {
    const res = await AppUpdater.canInstallPackages();
    return !!res?.granted;
  } catch {
    return false;
  }
}

export async function openApkInstallPermissionSettings(): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;
  try {
    const res = await AppUpdater.openInstallPermissionSettings();
    return !!res?.granted;
  } catch {
    return false;
  }
}

export async function startNativeApkDownloadAndInstall(
  url: string,
  versionName?: string,
  onProgress?: (event: DownloadProgressEvent) => void
): Promise<{ started: boolean; needsPermission?: boolean; pluginUnavailable?: boolean }> {
  if (!isNativeAndroidApp()) {
    return { started: false, pluginUnavailable: true };
  }

  let listener: PluginListenerHandle | null = null;
  try {
    if (onProgress) {
      listener = await AppUpdater.addListener('downloadProgress', onProgress);
    }
    const res = await AppUpdater.downloadAndInstallApk({ url, versionName });
    return {
      started: !!res?.started,
      needsPermission: !!res?.needsPermission,
    };
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    // Old APK installed before AppUpdaterPlugin existed will report UNIMPLEMENTED
    if (msg.toLowerCase().includes('unimplemented') || msg.toLowerCase().includes('not implemented')) {
      return { started: false, pluginUnavailable: true };
    }
    throw error;
  } finally {
    if (listener) {
      listener.remove().catch(() => {});
    }
  }
}

export function subscribeAppUpdateSettings(
  onUpdate: (settings: AppUpdateSettings | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'settings', 'app_update'),
    (snap) => {
      if (snap.exists()) {
        onUpdate({
          ...DEFAULT_APP_UPDATE_SETTINGS,
          ...(snap.data() as Partial<AppUpdateSettings>),
        });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/app_update');
      onUpdate(null);
    }
  );
}

export async function fetchAppUpdateSettingsFromServer(): Promise<AppUpdateSettings | null> {
  try {
    const snap = await getDocFromServer(doc(db, 'settings', 'app_update'));
    if (snap.exists()) {
      return {
        ...DEFAULT_APP_UPDATE_SETTINGS,
        ...(snap.data() as Partial<AppUpdateSettings>),
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/app_update');
    return null;
  }
}

export async function saveAppUpdateSettings(
  settings: Partial<AppUpdateSettings>,
  adminUid?: string,
  adminName?: string
): Promise<void> {
  const cleanCode = Math.max(1, Math.floor(Number(settings.latestVersionCode) || 1));
  const cleanName = String(settings.latestVersionName || `1.0.${cleanCode}`).trim().slice(0, 40);
  const cleanApkUrl = String(settings.apkUrl || '').trim().slice(0, 1000);

  if (cleanApkUrl && !cleanApkUrl.startsWith('https://')) {
    throw new Error('APK 다운로드 주소는 https:// 로 시작해야 합니다.');
  }

  const payload: AppUpdateSettings = {
    latestVersionCode: cleanCode,
    latestVersionName: cleanName,
    apkUrl: cleanApkUrl,
    githubRepo: normalizeGithubRepo(settings.githubRepo || ''),
    releaseNotes: String(settings.releaseNotes || '').trim().slice(0, 2000),
    forceUpdate: !!settings.forceUpdate,
    autoCheckEnabled: settings.autoCheckEnabled !== false,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid || auth.currentUser?.uid || 'admin',
    updatedByName: adminName || '관리자',
  };

  try {
    await setDoc(doc(db, 'settings', 'app_update'), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/app_update');
    throw error;
  }
}

export function normalizeGithubRepo(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const match = raw.match(/github\.com\/([^/\s]+\/[^/\s#?]+)/i);
  const repo = (match ? match[1] : raw).replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  if (repo.toLowerCase() === 'moonsukjoo/gun') {
    return DEFAULT_GITHUB_REPO;
  }
  return repo.slice(0, 200);
}

export interface GithubReleaseInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseNotes: string;
  tagName: string;
  publishedAt: string;
}

export async function fetchLatestGithubRelease(githubRepoInput: string): Promise<GithubReleaseInfo> {
  const repo = normalizeGithubRepo(githubRepoInput);
  if (!repo || !repo.includes('/')) {
    throw new Error('올바른 GitHub 저장소 형식(예: owner/repo)을 입력해주세요.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error('아직 GitHub Release가 없거나 저장소가 비공개입니다. GitHub에서 먼저 푸시/빌드를 1회 실행해 주세요.');
      }
      throw new Error(`GitHub API 오류 (HTTP ${resp.status})`);
    }

    const data = await resp.json();
    const assets: any[] = Array.isArray(data.assets) ? data.assets : [];
    const apkAsset =
      assets.find((a) => a.name === 'gunyoung-hrm-latest.apk') ||
      assets.find((a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk'));

    const bodyText = String(data.body || '');
    const codeMatch = bodyText.match(/Version\s*Code\s*:\s*(\d+)/i);
    const nameMatch = bodyText.match(/Version\s*Name\s*:\s*([^\s\r\n]+)/i);
    const tagStr = String(data.tag_name || '').replace(/^v/i, '');
    const tagNumMatch = tagStr.match(/(\d+)(?!.*\d)/);

    const parsedCode = codeMatch
      ? Number(codeMatch[1])
      : tagNumMatch
        ? 100 + Number(tagNumMatch[1])
        : 101;
    const parsedName = nameMatch ? nameMatch[1] : tagStr || `1.0.${parsedCode}`;

    return {
      versionCode: parsedCode,
      versionName: parsedName,
      apkUrl:
        apkAsset?.browser_download_url ||
        `https://github.com/${repo}/releases/latest/download/gunyoung-hrm-latest.apk`,
      releaseNotes: bodyText
        .replace(/자동 빌드된 최신 안드로이드 APK입니다\.?/g, '')
        .replace(/-\s*Version\s*(Name|Code)\s*:.*(\r?\n)?/gi, '')
        .trim(),
      tagName: String(data.tag_name || ''),
      publishedAt: String(data.published_at || ''),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function triggerManualUpdateCheck(): void {
  window.dispatchEvent(new CustomEvent('manual-app-update-check'));
}
