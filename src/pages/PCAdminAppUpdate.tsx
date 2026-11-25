import React, { useEffect, useState } from 'react';
import PCAdminLayout from '../components/PCAdminLayout';
import { useAuth } from '../components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  Save,
  Github,
  Coins,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import {
  AppUpdateSettings,
  DEFAULT_APK_URL,
  DEFAULT_APP_UPDATE_SETTINGS,
  DEFAULT_GITHUB_REPO,
  fetchLatestGithubRelease,
  normalizeGithubRepo,
  saveAppUpdateSettings,
  subscribeAppUpdateSettings,
} from '../services/appUpdateService';
import {
  KRW_PER_POINT,
  saveDailyAttendanceRewardKrw,
  useAttendanceRewardSettings,
} from '../services/attendancePointService';

const PCAdminAppUpdate: React.FC = () => {
  const { profile } = useAuth();
  const rewardMeta = useAttendanceRewardSettings();

  // Attendance reward state
  const [rewardInput, setRewardInput] = useState<string>(
    String(rewardMeta.dailyAttendanceRewardKrw)
  );
  const [savingReward, setSavingReward] = useState(false);

  // App update state
  const [githubRepo, setGithubRepo] = useState(DEFAULT_GITHUB_REPO);
  const [latestVersionCode, setLatestVersionCode] = useState('101');
  const [latestVersionName, setLatestVersionName] = useState('1.0.1');
  const [apkUrl, setApkUrl] = useState(DEFAULT_APK_URL);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [savedMeta, setSavedMeta] = useState<AppUpdateSettings | null>(null);
  const [fetchingGithub, setFetchingGithub] = useState(false);
  const [savingAppUpdate, setSavingAppUpdate] = useState(false);

  useEffect(() => {
    setRewardInput(String(rewardMeta.dailyAttendanceRewardKrw));
  }, [rewardMeta.dailyAttendanceRewardKrw]);

  useEffect(() => {
    const unsub = subscribeAppUpdateSettings((settings) => {
      if (settings) {
        setSavedMeta(settings);
        setGithubRepo(settings.githubRepo || DEFAULT_GITHUB_REPO);
        setLatestVersionCode(String(settings.latestVersionCode || 100));
        setLatestVersionName(settings.latestVersionName || '1.0.0');
        setApkUrl(settings.apkUrl || DEFAULT_APK_URL);
        setReleaseNotes(settings.releaseNotes || '');
        setForceUpdate(!!settings.forceUpdate);
        setAutoCheckEnabled(settings.autoCheckEnabled !== false);
      }
    });
    return () => unsub();
  }, []);

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(rewardInput);
    if (!Number.isFinite(num) || num < 0 || num > 100000) {
      toast.error('0원 이상 100,000원 이하의 금액을 입력해주세요.');
      return;
    }
    setSavingReward(true);
    try {
      const saved = await saveDailyAttendanceRewardKrw(
        num,
        profile?.uid,
        profile?.displayName || '관리자'
      );
      toast.success(
        `출근 칭찬포인트가 ${saved.toLocaleString()}원(${(saved / KRW_PER_POINT).toFixed(4)}P)으로 즉시 변경되었습니다.`
      );
    } catch (err) {
      console.error(err);
      toast.error('칭찬포인트 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingReward(false);
    }
  };

  const handleFetchGithub = async () => {
    const clean = normalizeGithubRepo(githubRepo);
    if (!clean) {
      toast.error('GitHub 저장소 주소(예: owner/repo)를 입력해주세요.');
      return;
    }
    setFetchingGithub(true);
    try {
      const gh = await fetchLatestGithubRelease(clean);
      setGithubRepo(clean);
      setLatestVersionCode(String(gh.versionCode));
      setLatestVersionName(gh.versionName);
      setApkUrl(gh.apkUrl);
      if (gh.releaseNotes) {
        setReleaseNotes(gh.releaseNotes);
      }
      toast.success(
        `최신 릴리스(${gh.tagName || `v${gh.versionName}`}) 정보를 불러왔습니다. 아래 [설정 저장]을 누르면 전 직원 앱에 반영됩니다.`
      );
    } catch (err: any) {
      toast.error(err?.message || 'GitHub 릴리스 조회에 실패했습니다.');
    } finally {
      setFetchingGithub(false);
    }
  };

  const handleSaveAppUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = apkUrl.trim();
    if (cleanUrl && !cleanUrl.startsWith('https://')) {
      toast.error('APK 다운로드 주소는 https:// 로 시작해야 합니다.');
      return;
    }
    const cleanCode = Math.max(1, Math.floor(Number(latestVersionCode) || 1));

    setSavingAppUpdate(true);
    try {
      await saveAppUpdateSettings(
        {
          githubRepo: normalizeGithubRepo(githubRepo),
          latestVersionCode: cleanCode,
          latestVersionName: latestVersionName.trim() || `1.0.${cleanCode}`,
          apkUrl: cleanUrl,
          releaseNotes,
          forceUpdate,
          autoCheckEnabled,
        },
        profile?.uid,
        profile?.displayName || '관리자'
      );
      toast.success('앱 자동 업데이트 설정이 저장되었습니다. 구버전 APK 실행 시 즉시 안내됩니다.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || '앱 업데이트 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingAppUpdate(false);
    }
  };

  return (
    <PCAdminLayout title="앱 자동 업데이트 · 출근 포인트 설정">
      <div className="max-w-[1280px] mx-auto p-4 lg:p-8 space-y-8 text-foreground pb-20">
        {/* Card 1: Realtime Daily Attendance Praise Point Setting */}
        <section className="bg-card border border-border rounded-[2rem] p-6 lg:p-8 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">
                  출근 시 칭찬포인트 지급 금액 (실시간 즉시 적용)
                </h2>
                <p className="text-xs font-bold text-muted-foreground mt-0.5">
                  앱을 새로 빌드하거나 재설치하지 않아도 저장 즉시 모든 직원의 출근 적립 금액과 화면 안내가 바뀝니다.
                </p>
              </div>
            </div>

            <div className="bg-muted px-4 py-2.5 rounded-2xl border border-border text-right shrink-0">
              <div className="text-[11px] font-bold text-muted-foreground">현재 적용 금액</div>
              <div className="text-lg font-black text-amber-500">
                {rewardMeta.dailyAttendanceRewardKrw.toLocaleString()}원 / 일
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveReward} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-muted-foreground mr-1">빠른 선택:</span>
              {[10, 30, 50, 100, 300, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRewardInput(String(preset))}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                    Number(rewardInput) === preset
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-muted/60 text-foreground border-border hover:border-amber-500/50'
                  }`}
                >
                  {preset}원
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-black text-muted-foreground">
                  1일 1회 출근 적립 금액 (원)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  value={rewardInput}
                  onChange={(e) => setRewardInput(e.target.value)}
                  className="h-12 rounded-xl bg-muted border-border font-black text-base"
                  placeholder="예: 30"
                />
              </div>

              <div className="bg-muted/60 border border-border rounded-xl px-4 h-12 flex items-center text-xs font-bold text-muted-foreground shrink-0">
                환산 포인트: {(Math.max(0, Number(rewardInput) || 0) / KRW_PER_POINT).toFixed(4)}P
              </div>

              <Button
                type="submit"
                disabled={savingReward}
                className="h-12 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm gap-2 cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                {savingReward ? '저장 중...' : '전 직원 즉시 적용'}
              </Button>
            </div>

            {rewardMeta.updatedAt && (
              <p className="text-[11px] font-bold text-muted-foreground">
                마지막 수정: {new Date(rewardMeta.updatedAt).toLocaleString('ko-KR')} (
                {rewardMeta.updatedByName || '관리자'})
              </p>
            )}
          </form>
        </section>

        {/* Card 2: Android APK Auto-Update Management */}
        <section className="bg-card border border-border rounded-[2rem] p-6 lg:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-600 shrink-0">
                <DownloadCloud className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">
                  안드로이드 APK 원터치 자동 업데이트 관리
                </h2>
                <p className="text-xs font-bold text-muted-foreground mt-0.5">
                  새 APK가 빌드되면 직원 앱 실행 시 자동으로 새 버전을 감지해 앱 안에서 바로 다운로드·설치합니다.
                </p>
              </div>
            </div>

            {savedMeta?.apkUrl && (
              <a
                href={savedMeta.apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-blue-600/10 text-blue-600 font-black text-xs border border-blue-500/20 hover:bg-blue-600/15 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                현재 등록 APK v{savedMeta.latestVersionName}
              </a>
            )}
          </div>

          {/* 3-Step Automation Guide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-muted/50 border border-border/70 space-y-1">
              <div className="text-xs font-black text-blue-600 flex items-center gap-1.5">
                <Github className="w-4 h-4" />
                1. GitHub 저장소 1회 연결
              </div>
              <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                아래에 GitHub 저장소(`아이디/저장소명`)를 입력해 두면 GitHub 빌드 완료 시 자동으로 릴리스 버전이 올라갑니다.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-muted/50 border border-border/70 space-y-1">
              <div className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                2. 자동 버전 감지
              </div>
              <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                직원 스마트폰 앱이 켜질 때 현재 설치 버전과 최신 버전을 자동 비교합니다.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-muted/50 border border-border/70 space-y-1">
              <div className="text-xs font-black text-indigo-600 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                3. 앱 내 원터치 설치
              </div>
              <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                직원은 팝업에서 [지금 자동 업데이트]만 누르면 진행률 표시 후 바로 안드로이드 설치 창이 열립니다.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveAppUpdate} className="space-y-5">
            {/* GitHub Repo Quick Sync */}
            <div className="p-5 rounded-3xl bg-blue-600/[0.04] border border-blue-500/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Github className="w-4 h-4 text-blue-600" />
                  연동된 GitHub 저장소 (`moonsukjoo/gun` → `moonsukjoo/Gunmyoung` 공개)
                </label>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  최고 관리자: tjrwnfjqm1@gmail.com
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="moonsukjoo/Gunmyoung"
                  className="h-12 rounded-xl bg-card border-border font-bold text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFetchGithub}
                  disabled={fetchingGithub}
                  className="h-12 px-5 rounded-xl font-black text-xs gap-2 border-blue-500/30 bg-card hover:bg-blue-600/10 text-blue-600 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${fetchingGithub ? 'animate-spin' : ''}`} />
                  {fetchingGithub ? '불러오는 중...' : 'GitHub 최신 릴리스 불러오기'}
                </Button>
              </div>
              <p className="text-[11px] font-bold text-muted-foreground">
                기본 저장소(`moonsukjoo/Gunmyoung`)가 이미 연결되어 있습니다. GitHub에 코드를 공유(Push)해 APK 빌드가 끝나면 직원 앱에서 자동으로 새 버전을 감지합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-muted-foreground">
                  최신 버전 이름 (예: 1.0.15)
                </label>
                <Input
                  type="text"
                  value={latestVersionName}
                  onChange={(e) => setLatestVersionName(e.target.value)}
                  placeholder="예: 1.0.15"
                  className="h-12 rounded-xl bg-muted border-border font-black text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-muted-foreground">
                  최신 버전 코드 (정수 · 기존 앱보다 크면 업데이트 알림)
                </label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={latestVersionCode}
                  onChange={(e) => setLatestVersionCode(e.target.value)}
                  placeholder="예: 115"
                  className="h-12 rounded-xl bg-muted border-border font-black text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-muted-foreground">
                APK 다운로드 URL (https:// 로 시작하는 직접 링크)
              </label>
              <Input
                type="url"
                value={apkUrl}
                onChange={(e) => setApkUrl(e.target.value)}
                placeholder={DEFAULT_APK_URL}
                className="h-12 rounded-xl bg-muted border-border font-bold text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-muted-foreground">
                직원에게 보여줄 업데이트 안내 문구
              </label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                rows={3}
                placeholder="예: 출근 칭찬포인트 30원 적용 및 원터치 자동 업데이트 기능 추가"
                className="w-full p-3.5 rounded-xl bg-muted border border-border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border cursor-pointer">
                <div>
                  <div className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    앱 실행 시 자동 업데이트 확인
                  </div>
                  <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                    구버전 앱 사용자에게 자동으로 새 버전 안내창 표시
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoCheckEnabled}
                  onChange={(e) => setAutoCheckEnabled(e.target.checked)}
                  className="w-5 h-5 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 cursor-pointer">
                <div>
                  <div className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    필수 업데이트 (강제 적용)
                  </div>
                  <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                    '나중에' 버튼을 숨기고 업데이트 전까지 안내 고정
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={forceUpdate}
                  onChange={(e) => setForceUpdate(e.target.checked)}
                  className="w-5 h-5 accent-rose-600"
                />
              </label>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-[11px] font-bold text-muted-foreground">
                {savedMeta?.updatedAt
                  ? `최근 설정 저장: ${new Date(savedMeta.updatedAt).toLocaleString('ko-KR')} (${savedMeta.updatedByName || '관리자'})`
                  : '아직 저장된 자동 업데이트 설정이 없습니다.'}
              </p>
              <Button
                type="submit"
                disabled={savingAppUpdate}
                className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {savingAppUpdate ? '저장 중...' : '앱 업데이트 설정 저장'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminAppUpdate;
