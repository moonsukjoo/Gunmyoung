import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  MapPin,
  RefreshCw,
  Info,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

interface DashboardStatusBarProps {
  isLocationRetentionActive: boolean;
  retentionRemainingMinutes: number;
  isInsideCheckInZone: boolean;
  distanceToCenter: number | null;
  refreshLocation: () => void;
  isMonitoring: boolean;
  startMonitoring: () => void;
  geofenceBufferMeters?: number;
}

export const DashboardStatusBar: React.FC<DashboardStatusBarProps> = ({
  isLocationRetentionActive,
  retentionRemainingMinutes,
  isInsideCheckInZone,
  distanceToCenter,
  refreshLocation,
  isMonitoring,
  startMonitoring,
  geofenceBufferMeters = 500
}) => {
  const [isRetentionModalOpen, setIsRetentionModalOpen] = React.useState(false);

  const formattedDist = distanceToCenter !== null
    ? distanceToCenter > 1000
      ? `${(distanceToCenter / 1000).toFixed(1)}km`
      : `${Math.round(distanceToCenter)}m`
    : '--';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-2 sm:p-2.5 px-3 shadow-xs">
        {/* Left: GPS & 15-Minute Retention Indicator Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {isLocationRetentionActive ? (
            <button
              type="button"
              onClick={() => setIsRetentionModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-black text-xs hover:bg-amber-500/25 transition-all cursor-pointer shadow-xs animate-pulse"
              title="클릭하여 상세 정보 확인"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>위치 유지 모드 ({retentionRemainingMinutes}분)</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/50 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-black">
                신호보호
              </Badge>
              <Info className="w-3 h-3 text-amber-600 dark:text-amber-400 ml-0.5 opacity-80" />
            </button>
          ) : isInsideCheckInZone ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-black text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
              <span>사업장 버퍼권 ({formattedDist} • 정상)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border/60 text-muted-foreground font-black text-xs">
              <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
              <span>사업장 외 ({formattedDist})</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => {
              refreshLocation();
              toast.info('GPS 위치를 새로고침했습니다.');
            }}
            title="GPS 새로고침"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        {/* Right: Sensor Status Chip */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/40 text-[11px] font-bold">
            <span className={cn("w-2 h-2 rounded-full shrink-0", isMonitoring ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
            <span className={isMonitoring ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-red-500 font-bold"}>
              {isMonitoring ? "안전센서 ON" : "센서 OFF"}
            </span>
            {!isMonitoring ? (
              <button
                type="button"
                onClick={startMonitoring}
                className="ml-1 text-[10px] text-primary hover:underline font-black cursor-pointer"
              >
                켜기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if ((window as any).simulateSafetySensor) {
                    (window as any).simulateSafetySensor('IMPACT');
                  } else {
                    toast.error('센서 기능이 준비되지 않았습니다.');
                  }
                }}
                className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-black cursor-pointer"
              >
                테스트
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Geofence Buffer & 15-Minute Retention Mode Explanation Dialog */}
      <Dialog open={isRetentionModalOpen} onOpenChange={setIsRetentionModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-5 bg-card border-border shadow-2xl text-foreground">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  위치 유지 모드 (15분) 안내
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  지오펜싱 허용 오차 버퍼({geofenceBufferMeters}m) 작동 중
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 font-bold space-y-1">
              <p className="flex items-center gap-1.5 font-black text-[13px]">
                <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                현재 신호 소실 방어 중 ({retentionRemainingMinutes}분 남음)
              </p>
              <p className="text-[11px] font-medium leading-normal">
                사업장 반경 {geofenceBufferMeters}m 버퍼 영역 진입이 확인되어 위치 유효성을 유지하고 있습니다.
              </p>
            </div>

            <ul className="list-disc pl-4 space-y-1.5 text-[11px]">
              <li>선박 내부, 도크 지하, 밀폐구역 등 <strong>GPS 음영 지역 진입 시에도 최소 15분간</strong> 정상 근무 위치로 인식됩니다.</li>
              <li>일시적인 GPS 전파 소실이나 지터로 인해 자동으로 조기 퇴근 처리되는 오작동을 원천 방지합니다.</li>
              <li>실외로 나오거나 위치가 재수신되면 정상 상태로 자동 갱신됩니다.</li>
            </ul>
          </div>

          <DialogFooter className="pt-2">
            <Button
              className="w-full h-10 rounded-xl font-black bg-primary text-primary-foreground"
              onClick={() => setIsRetentionModalOpen(false)}
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
