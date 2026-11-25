import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { db, auth } from '@/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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

export const DEFAULT_APP_UPDATE_SETTINGS: AppUpdateSettings = {
  latestVersionCode: 100,
  latestVersionName: '1.0.0',
  apkUrl: '',
  githubRepo: '',
  releaseNotes: '',
  forceUpdate: false,
  autoCheckEnabled: true,
};

export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function getInstalledAppVersion(): Promise<AppVersionInfo> {
  if (!isNativeAndroidApp()) {
    return {
      versionCode: 0,
      versionName: 'Web/PWA',
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
      console.warn('App update settings listener warning:', error);
      onUpdate(null);
    }
  );
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
  const repo = match ? match[1] : raw;
  return repo.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '').slice(0, 200);
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
