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
      {/* Balanced 2-Column Status Bar (Left: Workplace GPS / Right: Safety Sensor) */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left: GPS & Workplace Geofence Status */}
        <div 
          onClick={() => {
            if (isLocationRetentionActive) {
              setIsRetentionModalOpen(true);
            }
          }}
          className={cn(
            "relative flex items-center justify-between p-2.5 rounded-2xl bg-card/75 backdrop-blur-md border border-border/70 shadow-2xs transition-all",
            isLocationRetentionActive && "border-amber-500/40 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Status Pulse Indicator */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isLocationRetentionActive 
                  ? "bg-amber-400" 
                  : isInsideCheckInZone 
                    ? "bg-emerald-400" 
                    : "bg-muted-foreground"
              )} />
              <span className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                isLocationRetentionActive 
                  ? "bg-amber-500" 
                  : isInsideCheckInZone 
                    ? "bg-emerald-500" 
                    : "bg-muted-foreground/60"
              )} />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs font-black text-foreground truncate whitespace-nowrap break-keep">
                  {isLocationRetentionActive 
                    ? `위치유지 (${retentionRemainingMinutes}분)` 
                    : isInsideCheckInZone 
                      ? "사업장 버퍼권" 
                      : "사업장 외"}
                </p>
                {isLocationRetentionActive && (
                  <Info className="w-3 h-3 text-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground truncate">
                {isLocationRetentionActive 
                  ? "신호 소실 방어" 
                  : isInsideCheckInZone 
                    ? `${formattedDist} • 정상` 
                    : `${formattedDist} • 인식대기`}
              </p>
            </div>
          </div>

          {/* GPS Single-Refresh Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 ml-1 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              refreshLocation();
              toast.info('GPS 위치를 새로고침했습니다.');
            }}
            title="GPS 새로고침"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        {/* Right: Safety Sensor & Test Controller */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-card/75 backdrop-blur-md border border-border/70 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            {/* Sensor Status Dot */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {isMonitoring && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                isMonitoring ? "bg-emerald-500" : "bg-red-500"
              )} />
            </span>

            <div className="min-w-0">
              <p className={cn(
                "text-xs font-black truncate whitespace-nowrap break-keep",
                isMonitoring ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              )}>
                {isMonitoring ? "안전센서 ON" : "센서 OFF"}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground truncate">
                {isMonitoring ? "낙상·충격 감지" : "센서 비활성"}
              </p>
            </div>
          </div>

          {/* Test / Enable Button */}
          {isMonitoring ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if ((window as any).simulateSafetySensor) {
                  (window as any).simulateSafetySensor('IMPACT');
                } else {
                  toast.error('센서 기능이 준비되지 않았습니다.');
                }
              }}
              className="h-6 px-2 text-[10px] font-black rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 shrink-0 ml-1 cursor-pointer whitespace-nowrap break-keep shadow-2xs"
            >
              테스트
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startMonitoring}
              className="h-6 px-2 text-[10px] font-black rounded-lg border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 shrink-0 ml-1 cursor-pointer whitespace-nowrap break-keep shadow-2xs"
            >
              켜기
            </Button>
          )}
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
