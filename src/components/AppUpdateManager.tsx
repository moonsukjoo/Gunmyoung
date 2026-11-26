import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CheckCircle2,
  DownloadCloud,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { AnimatePresence, motion } from 'motion/react';
import {
  AppUpdateSettings,
  DEFAULT_GITHUB_REPO,
  DownloadProgressEvent,
  ServerVersionCandidate,
  VersionComparisonResult,
  applyWebUpdateSmoothly,
  buildVersionSignature,
  checkWebBundleChanged,
  compareSemver,
  compareVersionsDetailed,
  fetchAppUpdateSettingsFromServer,
  fetchLatestGithubRelease,
  getLocalVersionSnapshot,
  getSavedLocalVersionRecord,
  openApkInstallPermissionSettings,
  saveAppliedVersionSnapshot,
  startNativeApkDownloadAndInstall,
  subscribeAppUpdateSettings,
} from '@/services/appUpdateService';

const DISMISSED_SIGNATURE_STORAGE_KEY = 'dismissed_app_update_signature';

export const AppUpdateManager: React.FC = () => {
  const [settings, setSettings] = useState<AppUpdateSettings | null>(null);
  const [serverTarget, setServerTarget] = useState<ServerVersionCandidate | null>(null);
  const [comparison, setComparison] = useState<VersionComparisonResult | null>(null);
  const [isBannerOpen, setIsBannerOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [progress, setProgress] = useState<DownloadProgressEvent | null>(null);

  const sessionBootAtRef = useRef<number>(Date.now());
  const lastGithubCheckRef = useRef<number>(0);
  const lastBundleCheckRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    const unsub = subscribeAppUpdateSettings((next) => {
      if (mounted) setSettings(next);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const resolveLatestTarget = useCallback(
    async (
      currentSettings: AppUpdateSettings | null,
      forceRemoteCheck = false
    ): Promise<ServerVersionCandidate | null> => {
      let target: ServerVersionCandidate | null = null;

      if (currentSettings) {
        target = {
          versionCode: Number(currentSettings.latestVersionCode) || 1,
          versionName: currentSettings.latestVersionName || '1.0.0',
          apkUrl: currentSettings.apkUrl || '',
          releaseNotes: currentSettings.releaseNotes || '',
          forceUpdate: !!currentSettings.forceUpdate,
          updatedAt: currentSettings.updatedAt,
          source: 'firestore',
        };
      }

      const repo = (currentSettings?.githubRepo ?? DEFAULT_GITHUB_REPO).trim();
      const autoCheck = currentSettings ? currentSettings.autoCheckEnabled !== false : true;
      const now = Date.now();
      const shouldFetchGithub =
        !!repo &&
        autoCheck &&
        (forceRemoteCheck || now - lastGithubCheckRef.current > 10 * 60 * 1000);

      if (shouldFetchGithub && repo) {
        lastGithubCheckRef.current = now;
        try {
          const gh = await fetchLatestGithubRelease(repo);
          const isGhNewer =
            !target ||
            gh.versionCode > target.versionCode ||
            (gh.versionCode === target.versionCode &&
              compareSemver(gh.versionName, target.versionName) > 0);

          if (isGhNewer) {
            target = {
              versionCode: gh.versionCode,
              versionName: gh.versionName,
              apkUrl: gh.apkUrl,
              releaseNotes: gh.releaseNotes || target?.releaseNotes || '',
              forceUpdate: !!currentSettings?.forceUpdate,
              updatedAt: gh.publishedAt || target?.updatedAt,
              source: 'github',
            };
          }
        } catch (err) {
          console.warn('GitHub release check skipped:', err);
        }
      }

      return target;
    },
    []
  );

  const evaluateUpdateStatus = useCallback(
    async (
      currentSettings: AppUpdateSettings | null,
      options?: { forceRemote?: boolean; manualTrigger?: boolean }
    ) => {
      const currentLocal = await getLocalVersionSnapshot();
      const target = await resolveLatestTarget(currentSettings, !!options?.forceRemote);

      let webBundleChanged = false;
      const now = Date.now();
      if (
        !currentLocal.isNativeAndroid &&
        (options?.forceRemote || now - lastBundleCheckRef.current > 5 * 60 * 1000)
      ) {
        lastBundleCheckRef.current = now;
        webBundleChanged = await checkWebBundleChanged();
      }

      if (!target && !webBundleChanged) {
        return { local: currentLocal, target: null, result: null };
      }

      const effectiveTarget: ServerVersionCandidate = target || {
        versionCode: currentLocal.versionCode,
        versionName: currentLocal.versionName,
        apkUrl: '',
        releaseNotes: '최신 웹 화면 리소스가 배포되었습니다.',
        forceUpdate: false,
        updatedAt: new Date().toISOString(),
        source: 'web_bundle',
      };

      const result = compareVersionsDetailed(currentLocal, effectiveTarget, {
        webBundleChanged,
        sessionBootAtMs: sessionBootAtRef.current,
      });

      // Seed initial baseline on first fresh Web visit only when already up-to-date
      if (
        !currentLocal.isNativeAndroid &&
        !result.needsUpdate &&
        !getSavedLocalVersionRecord() &&
        effectiveTarget.versionCode > 0
      ) {
        saveAppliedVersionSnapshot({
          versionCode: effectiveTarget.versionCode,
          versionName: effectiveTarget.versionName,
          updatedAt: effectiveTarget.updatedAt,
          signature: buildVersionSignature(effectiveTarget),
        });
      }

      if (result.needsUpdate) {
        if (result.requiresApkDownload && !effectiveTarget.apkUrl) {
          return { local: currentLocal, target: effectiveTarget, result: null };
        }
        setServerTarget(effectiveTarget);
        setComparison(result);

        const sig = `${buildVersionSignature(effectiveTarget)}:${result.reason}`;
        const dismissedSig = sessionStorage.getItem(DISMISSED_SIGNATURE_STORAGE_KEY);

        if (options?.manualTrigger || dismissedSig !== sig) {
          setNeedsPermission(false);
          setIsBannerOpen(true);
        }
      } else {
        setServerTarget(effectiveTarget);
        setComparison(result);
        if (!options?.manualTrigger) {
          setIsBannerOpen(false);
        }
      }

      return { local: currentLocal, target: effectiveTarget, result };
    },
    [resolveLatestTarget]
  );

  // Automatic comparison on mount and whenever Firestore settings/app_update updates
  useEffect(() => {
    if (settings && settings.autoCheckEnabled === false) return;

    let cancelled = false;
    evaluateUpdateStatus(settings, { forceRemote: false }).then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [settings, evaluateUpdateStatus]);

  const lastFocusEvalRef = useRef<number>(0);

  // Re-check gently when user returns to the app/tab (throttled to min 5 min intervals)
  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (settings && settings.autoCheckEnabled === false) return;
      const now = Date.now();
      if (now - lastFocusEvalRef.current < 5 * 60 * 1000) return;
      lastFocusEvalRef.current = now;
      evaluateUpdateStatus(settings, { forceRemote: false });
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [settings, evaluateUpdateStatus]);

  // Manual check event (triggered from MyPage -> "앱 업데이트 확인")
  useEffect(() => {
    const handleManualCheck = async () => {
      const serverSettings = (await fetchAppUpdateSettingsFromServer()) || settings;
      if (serverSettings) {
        setSettings(serverSettings);
      }

      const { local, target, result } = await evaluateUpdateStatus(serverSettings, {
        forceRemote: true,
        manualTrigger: true,
      });

      if (!result || !result.needsUpdate) {
        if (!local.isNativeAndroid && target?.apkUrl) {
          toast.success(result?.summary || '현재 최신 웹 버전을 사용 중입니다.', {
            description: `안드로이드 최신 APK: v${target.versionName}`,
            action: {
              label: 'APK 받기',
              onClick: () => {
                window.open(target.apkUrl, '_blank', 'noopener,noreferrer');
              },
            },
          });
        } else {
          toast.success(
            result?.summary ||
              `현재 최신 버전(v${local.versionName})을 사용 중입니다.`
          );
        }
      } else {
        toast.info('새로운 업데이트가 확인되었습니다. 아래 안내에서 [업데이트 반영]을 눌러주세요.');
      }
    };

    window.addEventListener('manual-app-update-check', handleManualCheck);
    return () => window.removeEventListener('manual-app-update-check', handleManualCheck);
  }, [settings, evaluateUpdateStatus]);

  const handleApplyUpdate = async () => {
    if (!serverTarget || !comparison) return;

    // Case 1: Web/PWA or soft metadata sync (no APK binary installation required)
    if (!comparison.requiresApkDownload) {
      setIsApplying(true);
      toast.info('최신 업데이트를 부드럽게 반영합니다...');
      try {
        await applyWebUpdateSmoothly({
          versionCode: serverTarget.versionCode,
          versionName: serverTarget.versionName,
          updatedAt: serverTarget.updatedAt,
        });
      } catch (err) {
        console.error('Web update apply failed:', err);
        setIsApplying(false);
        toast.error('업데이트 반영 중 일시적인 오류가 발생했습니다. 다시 시도해 주세요.');
      }
      return;
    }

    // Case 2: Native Android APK download & install
    if (!serverTarget.apkUrl) {
      toast.error('등록된 APK 다운로드 경로가 없습니다.');
      return;
    }

    setIsApplying(true);
    setProgress({ percent: 0, downloadedBytes: 0, totalBytes: 0 });

    try {
      const res = await startNativeApkDownloadAndInstall(
        serverTarget.apkUrl,
        serverTarget.versionName,
        (ev) => setProgress(ev)
      );

      if (res.needsPermission) {
        setNeedsPermission(true);
        setIsApplying(false);
        return;
      }

      if (res.pluginUnavailable) {
        toast.info('설치 파일 다운로드를 시작합니다. 이번 1회 설치 후부터 앱 내 원터치 업데이트가 지원됩니다.');
        try {
          await Browser.open({ url: serverTarget.apkUrl });
        } catch {
          window.open(serverTarget.apkUrl, '_blank', 'noopener,noreferrer');
        }
        setIsApplying(false);
        return;
      }

      if (res.started) {
        saveAppliedVersionSnapshot({
          versionCode: serverTarget.versionCode,
          versionName: serverTarget.versionName,
          updatedAt: serverTarget.updatedAt,
          signature: buildVersionSignature(serverTarget),
        });
        toast.success('안드로이드 설치 화면이 열립니다. [업데이트/설치]를 눌러 완료해 주세요.');
        setIsApplying(false);
      }
    } catch (error: any) {
      console.error('APK update failed:', error);
      toast.error(error?.message || '업데이트 다운로드에 실패했습니다.');
      setIsApplying(false);
    }
  };

  const handleOpenPermission = async () => {
    const granted = await openApkInstallPermissionSettings();
    if (granted) {
      setNeedsPermission(false);
      handleApplyUpdate();
    } else {
      toast.info("'이 출처의 앱 허용' 스위치를 켠 뒤 [설치 계속하기]를 눌러주세요.");
    }
  };

  const handleDismiss = () => {
    if (serverTarget && comparison) {
      sessionStorage.setItem(
        DISMISSED_SIGNATURE_STORAGE_KEY,
        `${buildVersionSignature(serverTarget)}:${comparison.reason}`
      );
    }
    setIsBannerOpen(false);
  };

  const formatMb = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const showConflictTip = comparison?.requiresApkDownload;

  return (
    <AnimatePresence>
      {isBannerOpen && serverTarget && comparison && (
        <motion.aside
          key="gentle-update-banner"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[410px] z-40 rounded-3xl bg-card/95 backdrop-blur-xl border border-border/90 shadow-2xl p-4 sm:p-5 text-foreground"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                  needsPermission
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                    : 'bg-blue-600/15 border-blue-500/25 text-blue-600 dark:text-blue-400'
                }`}
              >
                {needsPermission ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm font-black tracking-tight text-foreground">
                    {needsPermission ? '앱 설치 권한 허용 필요' : '새 업데이트 안내'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-blue-600/12 text-blue-600 dark:text-blue-400">
                    {comparison.updateTypeLabel}
                  </span>
                  {serverTarget.forceUpdate && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      권장
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-muted-foreground mt-0.5 truncate">
                  {needsPermission
                    ? "'이 출처의 앱 허용' 스위치를 1회만 켜주세요."
                    : comparison.summary}
                </p>
              </div>
            </div>

            {!isApplying && (
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="알림 닫기"
                className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Fine-grained local vs server version comparison */}
          {!needsPermission && (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-muted/60 border border-border/60 text-[11px] font-bold">
                <div className="truncate">
                  <span className="text-muted-foreground">로컬 </span>
                  <span className="text-foreground font-extrabold">
                    v{comparison.localVersionName}
                    {comparison.localVersionCode > 0 ? ` (${comparison.localVersionCode})` : ''}
                  </span>
                </div>
                <span className="text-muted-foreground shrink-0">→</span>
                <div className="truncate text-right">
                  <span className="text-muted-foreground">서버 </span>
                  <span className="text-blue-600 dark:text-blue-400 font-black">
                    v{comparison.serverVersionName}
                    {comparison.serverVersionCode > 0 ? ` (${comparison.serverVersionCode})` : ''}
                  </span>
                </div>
              </div>

              {serverTarget.releaseNotes && (
                <div className="px-3 py-2 rounded-2xl bg-muted/40 border border-border/50 text-[11px] font-medium text-foreground/90 whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">
                  {serverTarget.releaseNotes}
                </div>
              )}

              {isApplying && comparison.requiresApkDownload && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-[11px] font-black text-blue-600 dark:text-blue-400">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      업데이트 파일 받는 중...
                    </span>
                    <span>
                      {progress && progress.percent >= 0
                        ? `${progress.percent}%`
                        : formatMb(progress?.downloadedBytes || 0)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-150"
                      style={{ width: `${Math.max(5, progress?.percent || 8)}%` }}
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

          {/* Action buttons */}
          <div className="mt-3.5 flex flex-col gap-2">
            {needsPermission ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleOpenPermission}
                  className="flex-1 h-10 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  허용 설정 열기
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNeedsPermission(false);
                    handleApplyUpdate();
                  }}
                  className="flex-1 h-10 rounded-2xl font-black text-xs cursor-pointer"
                >
                  설치 계속하기
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleApplyUpdate}
                  disabled={isApplying}
                  className="flex-1 h-10 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {isApplying ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : comparison.requiresApkDownload ? (
                    <DownloadCloud className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {isApplying
                    ? comparison.requiresApkDownload
                      ? '다운로드 중...'
                      : '업데이트 반영 중...'
                    : '업데이트 반영'}
                </Button>
                {!isApplying && (
                  <Button
                    variant="outline"
                    onClick={handleDismiss}
                    className="h-10 px-4 rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  >
                    나중에
                  </Button>
                )}
              </div>
            )}

            {!needsPermission && showConflictTip && !isApplying && (
              <div className="space-y-1 pt-0.5">
                {serverTarget.apkUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(serverTarget.apkUrl, '_blank', 'noopener,noreferrer')}
                    className="w-full py-0.5 text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    브라우저로 직접 내려받기
                  </button>
                )}
                <p className="text-[10px] font-medium text-muted-foreground/85 text-center leading-snug">
                  ※ &apos;기존 패키지와 충돌&apos; 시 기존 앱 1회 삭제 후 재설치하면 이후부터 바로 덮어쓰기 됩니다.
                </p>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
