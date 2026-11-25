import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { SHIP_PARTS } from '@/services/shipService';
import { formatPointsDisplay, pointsToKrw } from '@/services/attendancePointService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Anchor,
  Zap,
  Compass,
  Layout,
  Fan,
  Box,
  Ship,
  Trophy,
  Sparkles,
  Wrench,
  Radar,
  Shield,
  Flag,
  Home,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { MarineSubpageHero } from '@/components/MarineSubpageHero';
import { Icon3DShip } from '@/components/icons/Marine3DIcons';

const PART_ICONS: Record<string, any> = {
  ENGINE: Zap,
  PROPELLER: Fan,
  RADAR: Radar,
  DECK: Layout,
  HULL: Shield,
  MAST: Flag,
  ANCHOR: Anchor,
  RUDDER: Compass,
  CABIN: Home,
  CRANE: Wrench,
};

export const ShipAssembly: React.FC = () => {
  const { profile } = useAuth();
  const [ownedParts, setOwnedParts] = useState<string[]>([]);
  const [isAssembling, setIsAssembling] = useState(false);

  const isHighContrast = !!profile?.highContrast;
  const isLight = profile?.lightTheme !== false && !isHighContrast;

  useEffect(() => {
    if (profile?.shipParts) {
      setOwnedParts(profile.shipParts);
    } else {
      setOwnedParts([]);
    }
  }, [profile]);

  const uniqueOwnedParts = [...new Set(ownedParts)];
  const isComplete = SHIP_PARTS.every((part) => uniqueOwnedParts.includes(part.id));

  // Automatic assembly trigger
  useEffect(() => {
    if (isComplete && !isAssembling && profile) {
      handleAssemble();
    }
  }, [isComplete, isAssembling, profile]);

  const handleAssemble = async () => {
    if (!profile || isAssembling) return;
    if (!isComplete) return;

    setIsAssembling(true);
    try {
      const newParts = [...ownedParts];
      SHIP_PARTS.forEach((part) => {
        const index = newParts.indexOf(part.id);
        if (index > -1) newParts.splice(index, 1);
      });

      const couponId = Math.random().toString(36).substring(2, 9);
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const timeStr = today.toTimeString().slice(0, 5);

      const { addDoc, collection } = await import('firebase/firestore');

      await addDoc(collection(db, 'praiseCoupons'), {
        id: couponId,
        senderUid: 'SYSTEM',
        senderName: '함선 건조 시스템',
        senderRole: 'SYSTEM' as any,
        receiverUid: profile.uid,
        receiverName: profile.displayName,
        date: dateStr,
        time: timeStr,
        location: '선박 조립 공장',
        reason: '함선 1척 건조 완료 보상',
        points: 1,
        createdAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, 'users', profile.uid), {
        shipParts: newParts,
        completedShips: increment(1),
      });

      await addDoc(collection(db, 'notifications'), {
        uid: profile.uid,
        title: '함선 조립 성공! 🚢',
        message: '함선 조립을 완료하여 칭찬쿠폰 1매가 지급되었습니다.',
        type: 'COUPON',
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      toast.success('함선 조립 완료!', { description: '칭찬쿠폰 1매가 지급되었습니다.' });
    } catch (error) {
      console.error('Assembly error:', error);
      toast.error('함선 조립 중 오류가 발생했습니다.');
    } finally {
      setIsAssembling(false);
    }
  };

  const cardSurfaceClass = isHighContrast
    ? 'bg-card border-2 border-border text-foreground shadow-none'
    : isLight
      ? 'bg-white border border-slate-200/80 text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.06)]'
      : 'bg-[#111B2E]/92 border border-white/12 text-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]';

  const ptsText = formatPointsDisplay(profile?.points);
  const krwText = pointsToKrw(profile?.points).toLocaleString();
  const completedShips = Number(profile?.completedShips ?? 0);

  return (
    <div className="w-full space-y-4 pb-28 overflow-x-hidden bg-background">
      <MarineSubpageHero
        isLight={isLight}
        highContrast={isHighContrast}
        icon={<Icon3DShip className="w-8 h-8" />}
        iconBedClass={isLight ? 'bg-[#E6F6FE]' : 'bg-sky-500/15'}
        subtitle="부품을 모아 건명 제 1호 선박을 완성하세요"
        title="선박 조립 · 칭찬 포인트"
      >
        <div
          className={cn(
            'grid grid-cols-2 gap-2.5 pt-3 border-t',
            isLight ? 'border-slate-100' : 'border-border/40'
          )}
        >
          <div
            className={cn(
              'p-2.5 rounded-2xl border',
              isLight ? 'bg-[#FFF8EB] border-amber-200/70' : 'bg-muted/40 border-border/50'
            )}
          >
            <p className="text-[10px] font-bold text-muted-foreground">보유 칭찬 포인트</p>
            <p className="text-xs font-black text-foreground mt-0.5 tabular-nums">
              {ptsText} P · {krwText}원
            </p>
          </div>
          <div
            className={cn(
              'p-2.5 rounded-2xl border',
              isLight ? 'bg-[#EFF6FF] border-blue-200/70' : 'bg-muted/40 border-border/50'
            )}
          >
            <p className="text-[10px] font-bold text-muted-foreground">완성한 선박</p>
            <p className="text-xs font-black text-foreground mt-0.5 tabular-nums">
              {completedShips}척 (완성 시 +1P)
            </p>
          </div>
        </div>
      </MarineSubpageHero>

      <div className="px-4 space-y-5">
        <Card className={cn('rounded-3xl overflow-hidden', cardSurfaceClass)}>
          <CardContent className="p-6 space-y-5">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                  수집 현황
                </p>
                <p className="text-4xl font-black text-foreground tabular-nums">
                  {uniqueOwnedParts.length}{' '}
                  <span className="text-lg font-bold text-muted-foreground">/ 10</span>
                </p>
              </div>
              <div
                className={cn(
                  'w-16 h-16 rounded-2xl flex items-center justify-center border',
                  isComplete
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                    : isLight
                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                      : 'bg-white/10 border-white/15 text-slate-300'
                )}
              >
                {isComplete ? (
                  <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
                ) : (
                  <Ship className="w-8 h-8" />
                )}
              </div>
            </div>

            <div
              className={cn(
                'w-full h-3 rounded-full overflow-hidden',
                isLight ? 'bg-slate-100' : 'bg-white/10'
              )}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(uniqueOwnedParts.length / 10) * 100}%` }}
                className="h-full bg-primary rounded-full shadow-sm"
              />
            </div>

            <Button
              disabled={!isComplete || isAssembling}
              onClick={handleAssemble}
              className={cn(
                'w-full h-14 rounded-2xl font-black text-base transition-all cursor-pointer',
                isComplete
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : isLight
                    ? 'bg-slate-100 text-slate-600 border border-slate-200'
                    : 'bg-white/10 text-slate-300 border border-white/10'
              )}
            >
              {isAssembling ? '조립 중...' : isComplete ? '함선 완성하기' : '부품을 더 모아주세요'}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {SHIP_PARTS.map((part) => {
            const isOwned = ownedParts.includes(part.id);
            const count = ownedParts.filter((id) => id === part.id).length;
            const Icon = PART_ICONS[part.id] || Box;
            return (
              <div
                key={part.id}
                className={cn(
                  'p-5 rounded-3xl border transition-all h-full flex flex-col items-center gap-3 text-center relative',
                  isOwned
                    ? isLight
                      ? 'bg-blue-50/90 border-blue-300 text-slate-900 shadow-xs'
                      : 'bg-primary/15 border-primary/40 text-white'
                    : isHighContrast
                      ? 'bg-card border-border/80 text-foreground opacity-85'
                      : isLight
                        ? 'bg-white border-slate-200/90 text-slate-700 shadow-xs'
                        : 'bg-[#111B2E]/80 border-white/10 text-slate-200'
                )}
              >
                {isOwned && (
                  <span className="absolute top-3 right-3 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                )}
                <div className="relative">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center transition-all',
                      isOwned
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : isLight
                          ? 'bg-slate-100 text-slate-500 border border-slate-200'
                          : 'bg-white/10 text-slate-300 border border-white/10'
                    )}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                  {count > 1 && (
                    <div className="absolute -bottom-1 -right-1 bg-foreground text-background text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-card">
                      x{count}
                    </div>
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      'text-sm font-black',
                      isOwned ? 'text-foreground' : 'text-foreground/85'
                    )}
                  >
                    {part.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-bold mt-1 leading-tight">
                    {part.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className={cn('p-5 rounded-3xl flex items-center gap-4', cardSurfaceClass)}>
          <div className="w-12 h-12 bg-amber-500/15 rounded-2xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">부품 획득 안내</p>
            <p className="text-xs text-muted-foreground font-bold mt-1 leading-relaxed">
              출근, 공지 확인, 안전 퀴즈 등 활발한 활동을 통해 부품을 모을 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
