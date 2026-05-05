import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { SHIP_PARTS } from '@/src/services/shipService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Anchor, Zap, Compass, Layout, Fan, Box, Ship, Trophy, Sparkles, Wrench, Radar, Shield, Flag, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

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

  useEffect(() => {
    if (profile?.shipParts) {
      setOwnedParts(profile.shipParts);
    }
  }, [profile]);

  const uniqueOwnedParts = [...new Set(ownedParts)];
  const isComplete = SHIP_PARTS.every(part => uniqueOwnedParts.includes(part.id));

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
      // Remove one of each required part
      SHIP_PARTS.forEach(part => {
        const index = newParts.indexOf(part.id);
        if (index > -1) newParts.splice(index, 1);
      });

      // 1. Create a praise coupon automatically
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
        points: 1, // Award 1 praise point/coupon
        createdAt: new Date().toISOString()
      });

      // 2. Update user profile
      await updateDoc(doc(db, 'users', profile.uid), {
        shipParts: newParts,
        completedShips: increment(1)
      });

      // 3. Send notification
      await addDoc(collection(db, 'notifications'), {
        uid: profile.uid,
        title: '함선 조립 성공! 🚢',
        message: '함선 조립을 완료하여 칭찬쿠폰 1매가 지급되었습니다.',
        type: 'COUPON',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      toast.success('함선 조립 완료!', { description: '칭찬쿠폰 1매가 지급되었습니다.' });
    } catch (error) { 
      console.error("Assembly error:", error);
      toast.error('함선 조립 중 오류가 발생했습니다.'); 
    } finally { 
      setIsAssembling(false); 
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">선박 조립</h2>
        <p className="text-muted-foreground font-bold">부품을 모아 건명 제 1호 선박을 완성하세요</p>
      </header>

      <div className="space-y-6">
        <Card className="border-none shadow-none bg-card rounded-3xl overflow-hidden border border-white/5">
          <CardContent className="p-8 space-y-6">
             <div className="flex justify-between items-end">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">수집 현황</p>
                   <p className="text-4xl font-black text-white">{uniqueOwnedParts.length} <span className="text-lg text-muted-foreground">/ 10</span></p>
                </div>
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center">
                   {isComplete ? <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" /> : <Ship className="w-8 h-8 text-white/10" />}
                </div>
             </div>
             <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(uniqueOwnedParts.length / 10) * 100}%` }} className="h-full bg-primary rounded-full shadow-lg shadow-primary/20" />
             </div>
             <Button 
               disabled={!isComplete || isAssembling} 
               onClick={handleAssemble}
               className={cn("w-full h-16 rounded-3xl font-black text-lg transition-all", isComplete ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground")}
             >
               {isAssembling ? '조립 중...' : isComplete ? '함선 완성하기' : '부품을 더 모아주세요'}
             </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
           {SHIP_PARTS.map(part => {
             const isOwned = ownedParts.includes(part.id);
             const count = ownedParts.filter(id => id === part.id).length;
             const Icon = PART_ICONS[part.id] || Box;
             return (
               <div key={part.id} className={cn("bg-card p-5 rounded-3xl border transition-all h-full flex flex-col items-center gap-4 text-center", isOwned ? "border-primary/30 bg-primary/5" : "border-white/5 opacity-40")}>
                  <div className="relative">
                     <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all", isOwned ? "bg-primary text-white" : "bg-white/5 text-white/20")}>
                        <Icon className="w-7 h-7" />
                     </div>
                     {count > 1 && <div className="absolute -bottom-1 -right-1 bg-white text-black text-[9px] font-black px-1.5 py-0.5 rounded-lg border-2 border-card">x{count}</div>}
                  </div>
                  <div>
                     <p className="text-sm font-black text-white">{part.name}</p>
                     <p className="text-[10px] text-muted-foreground font-bold mt-1 leading-tight">{part.description}</p>
                  </div>
               </div>
             );
           })}
        </div>

        <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-center gap-4">
           <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-amber-500" />
           </div>
           <div>
              <p className="text-sm font-black text-white">부품 획득 안내</p>
              <p className="text-xs text-muted-foreground font-bold mt-1">출석, 공지 확인, 안전 퀴즈 등 활발한 활동을 통해 부품을 모을 수 있습니다.</p>
           </div>
        </div>
      </div>
    </div>
  );
};
