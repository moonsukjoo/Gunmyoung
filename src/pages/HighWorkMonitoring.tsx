import React, { useState, useEffect } from 'react';
import { db } from '@/src/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  ChevronLeft, 
  AlertTriangle, 
  ArrowUp, 
  Users, 
  Clock,
  ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { GlowLoading } from '@/src/components/GlowLoading';

export const HighWorkMonitoring: React.FC = () => {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));

    // Fetch users who have altitude data and are active
    const q = query(
      collection(db, 'users'),
      where('isActive', '==', true),
      orderBy('currentAltitude', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allWorkers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      // Filter active workers for either high work or immobility
      const tenMinutesAgo = new Date(Date.now() - 10 * 60000).toISOString();
      const monitoredWorkers = allWorkers.filter(w => 
        w.isActive && (
          ((w.currentAltitude || 0) > 0.5 && (w.altitudeUpdatedAt || '') > tenMinutesAgo) ||
          w.isImmobile ||
          w.isFalling ||
          w.hasImpacted
        )
      );
      
      await minLoadTime;
      setWorkers(monitoredWorkers);
      setLoading(false);
    }, (error) => {
      console.error("Altitude monitor error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <GlowLoading message="MONITOR" subMessage="Syncing Altitude Data..." />;

  const getRiskLevel = (worker: UserProfile) => {
    if (worker.isFalling) return { color: 'text-red-600', bg: 'bg-red-600/20', label: '추락 감지', icon: ShieldAlert, pulse: true };
    if (worker.hasImpacted) return { color: 'text-red-500', bg: 'bg-red-500/20', label: '충격 발생', icon: AlertTriangle, pulse: true };
    if (worker.isImmobile) return { color: 'text-red-500', bg: 'bg-red-500/10', label: '무동작 감지', icon: ShieldAlert };
    const altitude = worker.currentAltitude || 0;
    if (altitude > 10) return { color: 'text-red-500', bg: 'bg-red-500/10', label: '고위험', icon: ShieldAlert };
    if (altitude > 3) return { color: 'text-orange-500', bg: 'bg-orange-500/10', label: '주의', icon: AlertTriangle };
    return { color: 'text-primary', bg: 'bg-primary/10', label: '정상', icon: ArrowUp };
  };

  return (
    <div className="min-h-screen bg-background pb-24 px-4">
      <header className="flex items-center justify-between py-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="w-12 h-12 rounded-2xl bg-white/5 text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight text-glow">고소 작업 모니터링</h2>
          </div>
        </div>
        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
          <BarChart3 className="w-6 h-6" />
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-card border-white/5 rounded-3xl overflow-hidden shadow-xl">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">상부 작업 인원</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{workers.length}</span>
              <span className="text-xs font-bold text-muted-foreground">명</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-white/5 rounded-3xl overflow-hidden shadow-xl">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">현재 무동작 인원</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-red-500">{workers.filter(w => w.isImmobile).length}</span>
              <span className="text-xs font-bold text-muted-foreground">명</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            실시간 고도 현황
          </h3>
          <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            10분 이내 업데이트 기준
          </span>
        </div>

        {workers.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {workers.map((worker) => {
                const risk = getRiskLevel(worker);
                const RiskIcon = risk.icon;

                return (
                  <motion.div
                    key={worker.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className="bg-card border-white/5 group hover:border-primary/20 transition-all rounded-3xl overflow-hidden shadow-lg">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn("w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0", risk.bg)}>
                            <RiskIcon className={cn("w-5 h-5 mb-1", risk.color)} />
                            <span className={cn("text-[9px] font-black uppercase text-center leading-none", risk.color)}>{risk.label}</span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-black text-white tracking-tight truncate">
                              {worker.displayName} <span className="text-[10px] text-muted-foreground font-bold ml-1">{worker.employeeId}</span>
                            </h4>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                              {worker.departmentName} · {worker.role}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {worker.isFalling || worker.hasImpacted ? (
                            <div className="flex flex-col items-end">
                               <Badge className="bg-red-600 text-white border-none animate-bounce mb-1">긴급 상황</Badge>
                               <p className="text-[8px] font-black text-white/60 uppercase tracking-widest bg-red-600 px-2 py-0.5 rounded-full">
                                 {worker.isFalling ? '추락 신호' : '강한 충격'}
                               </p>
                            </div>
                          ) : worker.isImmobile ? (
                            <div className="flex flex-col items-end">
                               <Badge className="bg-red-500 text-white border-none animate-pulse mb-1">무반응</Badge>
                               <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                                 {worker.lastMovementAt ? format(new Date(worker.lastMovementAt), 'HH:mm:ss') : 'N/A'} 기준
                               </p>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-baseline gap-1 justify-end">
                                <span className={cn("text-2xl font-black tabular-nums", risk.color)}>
                                  {(worker.currentAltitude || 0).toFixed(1)}
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground">m</span>
                              </div>
                              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                                {format(new Date(worker.altitudeUpdatedAt || ''), 'HH:mm:ss')}
                              </p>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 bg-white/5 rounded-[40px] border border-dashed border-white/10 gap-4 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-muted-foreground mb-2">
               <Users className="w-8 h-8 opacity-20" />
            </div>
            <div>
              <p className="text-sm font-black text-white/40 tracking-tight">상부 작업 인원이 없습니다</p>
              <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">
                현재 지상 0.5m 이상에서 감지된<br />작동 중인 기기가 없습니다.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-primary/5 rounded-[32px] border border-primary/10">
        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">안전 안내</h4>
        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
          • 본 시스템은 스마트폰 기압계 센서를 활용하여 지표면 대비 상대 고도를 측정합니다.<br />
          • 점심시간(12:00~13:00)에는 프라이버시 및 데이터 절약을 위해 측정이 중단됩니다.<br />
          • 측정값은 환경에 따라 ±1~2m의 오차가 발생할 수 있으니 참고용으로 사용하십시오.
        </p>
      </div>
    </div>
  );
};
