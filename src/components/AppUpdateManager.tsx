import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DownloadCloud, ShieldAlert, Sparkles, RefreshCw, ExternalLink } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import {
  AppUpdateSettings,
  AppVersionInfo,
  DEFAULT_GITHUB_REPO,
  DownloadProgressEvent,
  fetchLatestGithubRelease,
  getInstalledAppVersion,
  openApkInstallPermissionSettings,
  startNativeApkDownloadAndInstall,
  subscribeAppUpdateSettings,
} from '@/services/appUpdateService';

interface ResolvedUpdateInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
}

export const AppUpdateManager: React.FC = () => {
  const [installed, setInstalled] = useState<AppVersionInfo | null>(null);
  const [settings, setSettings] = useState<AppUpdateSettings | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<ResolvedUpdateInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [progress, setProgress] = useState<DownloadProgressEvent | null>(null);
  const lastGithubCheckRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    getInstalledAppVersion().then((info) => {
      if (mounted) setInstalled(info);
    });
    const unsub = subscribeAppUpdateSettings((next) => {
      if (mounted) setSettings(next);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const resolveLatestTarget = useCallback(
    async (forceGithubCheck = false): Promise<ResolvedUpdateInfo | null> => {
      let target: ResolvedUpdateInfo | null = null;

      if (settings && settings.apkUrl) {
        target = {
          versionCode: Number(settings.latestVersionCode) || 1,
          versionName: settings.latestVersionName || '1.0.0',
          apkUrl: settings.apkUrl,
          releaseNotes: settings.releaseNotes || '',
          forceUpdate: !!settings.forceUpdate,
        };
      }

      const repo = (settings?.githubRepo ?? DEFAULT_GITHUB_REPO).trim();
      const autoCheck = settings ? settings.autoCheckEnabled !== false : true;
      const now = Date.now();
      const shouldFetchGithub =
        repo &&
        autoCheck &&
        (forceGithubCheck || now - lastGithubCheckRef.current > 10 * 60 * 1000);

      if (shouldFetchGithub && repo) {
        lastGithubCheckRef.current = now;
        try {
          const gh = await fetchLatestGithubRelease(repo);
          if (!target || gh.versionCode > target.versionCode) {
            target = {
              versionCode: gh.versionCode,
              versionName: gh.versionName,
              apkUrl: gh.apkUrl,
              releaseNotes: gh.releaseNotes || target?.releaseNotes || '',
              forceUpdate: !!settings?.forceUpdate,
            };
          }
        } catch (err) {
          console.warn('GitHub release auto-check skipped:', err);
        }
      }

      return target;
    },
    [settings]
  );

  // Automatic check for native Android APK users (uses Firestore settings or moonsukjoo/Gunmyoung default)
  useEffect(() => {
    if (!installed?.isNativeAndroid) return;
    if (settings && settings.autoCheckEnabled === false) return;

    let cancelled = false;
    resolveLatestTarget(false).then((target) => {
      if (cancelled || !target || !target.apkUrl) return;
      if (target.versionCode > installed.versionCode) {
        const dismissedCode = sessionStorage.getItem('dismissed_app_update_code');
        setAvailableUpdate(target);
        if (target.forceUpdate || dismissedCode !== String(target.versionCode)) {
          setIsModalOpen(true);
        }
      } else {
        setAvailableUpdate(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [installed, settings, resolveLatestTarget]);

  // Manual check event (triggered from MyPage -> "앱 업데이트 확인")
  useEffect(() => {
    const handleManualCheck = async () => {
      const current = installed || (await getInstalledAppVersion());
      setInstalled(current);

      if (!current.isNativeAndroid) {
        const target = await resolveLatestTarget(true);
        if (target?.apkUrl) {
          toast.info(`웹 버전은 실시간 최신 상태입니다. (최신 안드로이드 APK: v${target.versionName})`, {
            action: {
              label: 'APK 받기',
              onClick: () => {
                window.open(target.apkUrl, '_blank', 'noopener,noreferrer');
              },
            },
          });
        } else {
          toast.success('웹 버전은 항상 최신 상태가 자동 적용됩니다.');
        }
        return;
      }

      const target = await resolveLatestTarget(true);
      if (!target || !target.apkUrl) {
        toast.info(`현재 버전 v${current.versionName} (코드 ${current.versionCode}) — 등록된 새 APK 버전이 없습니다.`);
        return;
      }

      if (target.versionCode > current.versionCode) {
        setAvailableUpdate(target);
        setNeedsPermission(false);
        setIsModalOpen(true);
      } else {
        setAvailableUpdate(null);
        toast.success(`현재 최신 버전(v${current.versionName})을 사용 중입니다.`);
      }
    };

    window.addEventListener('manual-app-update-check', handleManualCheck);
    return () => window.removeEventListener('manual-app-update-check', handleManualCheck);
  }, [installed, resolveLatestTarget]);

  const handleStartUpdate = async () => {
    if (!availableUpdate?.apkUrl) return;
    setIsDownloading(true);
    setProgress({ percent: 0, downloadedBytes: 0, totalBytes: 0 });

    try {
      const res = await startNativeApkDownloadAndInstall(
        availableUpdate.apkUrl,
        availableUpdate.versionName,
        (ev) => setProgress(ev)
      );

      if (res.needsPermission) {
        setNeedsPermission(true);
        setIsDownloading(false);
        return;
      }

      if (res.pluginUnavailable) {
        // Older APK without AppUpdaterPlugin: open direct APK download URL in external browser once
        toast.info('설치 파일 다운로드를 시작합니다. 이번 1회 설치 후부터는 앱 내부 원터치 자동 업데이트가 지원됩니다.');
        try {
          await Browser.open({ url: availableUpdate.apkUrl });
        } catch {
          window.open(availableUpdate.apkUrl, '_blank', 'noopener,noreferrer');
        }
        setIsDownloading(false);
        return;
      }

      if (res.started) {
        toast.success('안드로이드 설치 화면이 열립니다. [업데이트/설치]를 눌러주세요.');
        setIsDownloading(false);
      }
    } catch (error: any) {
      console.error('APK update failed:', error);
      toast.error(error?.message || '업데이트 다운로드에 실패했습니다.');
      setIsDownloading(false);
    }
  };

  const handleOpenPermission = async () => {
    const granted = await openApkInstallPermissionSettings();
    if (granted) {
      setNeedsPermission(false);
      handleStartUpdate();
    } else {
      toast.info("'이 출처의 앱 허용' 스위치를 켠 뒤 [설치 계속하기]를 눌러주세요.");
    }
  };

  const handleDismiss = () => {
    if (availableUpdate?.forceUpdate) return;
    if (availableUpdate) {
      sessionStorage.setItem('dismissed_app_update_code', String(availableUpdate.versionCode));
    }
    setIsModalOpen(false);
  };

  const formatMb = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <Dialog
      open={isModalOpen}
      onOpenChange={(open) => {
        if (!open && availableUpdate?.forceUpdate) return;
        setIsModalOpen(open);
      }}
    >
      <DialogContent className="max-w-sm w-[92vw] rounded-3xl p-6 bg-card border border-border shadow-2xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-600 mb-1">
            {needsPermission ? (
              <ShieldAlert className="w-6 h-6 text-amber-500" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
          </div>
          <DialogTitle className="text-lg font-black text-foreground">
            {needsPermission ? '앱 설치 권한 허용 필요' : '새 버전 업데이트 안내'}
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-muted-foreground">
            {needsPermission
              ? "원터치 자동 업데이트를 위해 '이 출처의 앱 허용' 스위치를 1회만 켜주세요."
              : `건명기업 HRM v${availableUpdate?.versionName} 버전이 준비되었습니다.`}
          </DialogDescription>
        </DialogHeader>

        {!needsPermission && availableUpdate && (
          <div className="space-y-3 my-2">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/60 border border-border/60 text-xs font-bold">
              <span className="text-muted-foreground">
                현재: v{installed?.versionName || '1.0.0'}
              </span>
              <span className="text-blue-600 font-black">
                → 최신: v{availableUpdate.versionName}
              </span>
            </div>

            {availableUpdate.releaseNotes && (
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/50 text-xs text-foreground/90 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                {availableUpdate.releaseNotes}
              </div>
            )}

            {isDownloading && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-black text-blue-600">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    업데이트 파일 받는 중...
                  </span>
                  <span>
                    {progress && progress.percent >= 0 ? `${progress.percent}%` : formatMb(progress?.downloadedBytes || 0)}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-150"
                    style={{ width: `${Math.max(4, progress?.percent || 8)}%` }}
                  />
                </div>
                {progress && progress.totalBytes > 0 && (
                  <p className="text-[10px] font-bold text-muted-foreground text-right">
                    {formatMb(progress.downloadedBytes)} / {formatMb(progress.totalBytes)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-col pt-2">
          {needsPermission ? (
            <>
              <Button
                onClick={handleOpenPermission}
                className="w-full h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm gap-2 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                허용 설정 열기
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNeedsPermission(false);
                  handleStartUpdate();
                }}
                className="w-full h-11 rounded-2xl font-black text-xs cursor-pointer"
              >
                허용했어요 · 설치 계속하기
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleStartUpdate}
                disabled={isDownloading}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-sm gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4" />
                {isDownloading ? '다운로드 중...' : '지금 자동 업데이트'}
              </Button>
              {availableUpdate?.apkUrl && !isDownloading && (
                <button
                  type="button"
                  onClick={() => window.open(availableUpdate.apkUrl, '_blank', 'noopener,noreferrer')}
                  className="w-full py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  브라우저로 직접 내려받기
                </button>
              )}
              {!isDownloading && (
                <p className="text-[11px] font-medium text-muted-foreground/90 text-center leading-snug px-2">
                  ※ &apos;기존 패키지와 충돌&apos; 안내가 뜨면 기존 앱을 1회만 삭제 후 다시 설치해 주세요. 이후부터는 바로 덮어쓰기 업데이트됩니다.
                </p>
              )}
              {!availableUpdate?.forceUpdate && !isDownloading && (
                <Button
                  variant="ghost"
                  onClick={handleDismiss}
                  className="w-full h-10 rounded-2xl text-xs font-bold text-muted-foreground cursor-pointer"
                >
                  나중에 업데이트
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
