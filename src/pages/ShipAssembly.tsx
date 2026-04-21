import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { doc, updateDoc, increment, arrayRemove } from 'firebase/firestore';
import { SHIP_PARTS } from '@/src/services/shipService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Anchor, Zap, Compass, Layout, Maximize, Fan, Box, Ship, Trophy, Sparkles, XCircle, Wrench, Radar, Shield, Flag, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
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

  const handleAssemble = async () => {
    if (!profile) return;
    if (!isComplete) {
      toast.error('모든 부품(10종)을 모아야 함선을 조립할 수 있습니다.');
      return;
    }

    setIsAssembling(true);
    try {
      // Consume one of each part
      const newParts = [...ownedParts];
      SHIP_PARTS.forEach(part => {
        const index = newParts.indexOf(part.id);
        if (index > -1) {
          newParts.splice(index, 1);
        }
      });

      const rewardPoints = 50; // A large amount of points

      await updateDoc(doc(db, 'users', profile.uid), {
        shipParts: newParts,
        points: increment(rewardPoints),
        completedShips: increment(1)
      });

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0066CC', '#FFD700', '#FFFFFF']
      });

      toast.success('🎉 함선 조립 완료!', {
        description: `멋진 선박이 완성되었습니다! 보너스 ${rewardPoints}P가 지급되었습니다.`
      });
    } catch (error) {
      console.error("Assembly error:", error);
      toast.error('조립 중 오류가 발생했습니다.');
    } finally {
      setIsAssembling(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 py-8 px-4 pb-24 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-md text-center mb-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-full shadow-sm border border-slate-100 mb-2"
        >
          <Ship className="w-5 h-5 text-[#0066CC]" />
          <h2 className="text-xl font-black tracking-tight text-slate-900">나만의 함선 조립</h2>
        </motion.div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Assemble your dream vessel</p>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Progress Card */}
        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
          <CardContent className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="text-left">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Collection Progress</span>
                <h3 className="text-3xl font-black text-[#0066CC] leading-tight">
                  {uniqueOwnedParts.length} <span className="text-slate-400 text-lg">/ 10</span>
                </h3>
              </div>
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200 shadow-inner">
                {isComplete ? (
                  <Sparkles className="w-8 h-8 text-yellow-500 animate-pulse" />
                ) : (
                  <Ship className="w-8 h-8 text-slate-200" />
                )}
              </div>
            </div>

            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-8 border border-slate-50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(uniqueOwnedParts.length / 10) * 100}%` }}
                className="h-full bg-[#0066CC] rounded-full shadow-[0_0_12px_rgba(0,102,204,0.4)]"
              />
            </div>

            <Button 
              disabled={!isComplete || isAssembling}
              onClick={handleAssemble}
              className={cn(
                "w-full h-16 rounded-2xl font-black text-lg transition-all active:scale-95",
                isComplete 
                  ? "bg-[#0066CC] hover:bg-[#0052a3] shadow-lg shadow-[#0066CC]/20" 
                  : "bg-slate-100 text-slate-400 border-2 border-slate-200"
              )}
            >
              {isAssembling ? '조립 중...' : isComplete ? '함선 조립하기 (완성!)' : '부품을 모두 모아주세요'}
            </Button>

            {isComplete && (
              <p className="text-center text-[11px] font-bold text-[#0066CC] mt-4 animate-bounce">
                축하합니다! 조립 버튼을 클릭하여 보상을 받으세요.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Inventory Grid */}
        <div className="grid grid-cols-2 gap-4">
          {SHIP_PARTS.map((part) => {
            const isOwned = ownedParts.includes(part.id);
            const count = ownedParts.filter(id => id === part.id).length;
            const Icon = PART_ICONS[part.id] || Box;

            return (
              <motion.div
                key={part.id}
                whileHover={{ y: -4 }}
                className="relative group"
              >
                <Card className={cn(
                  "border-2 transition-all rounded-[2rem] overflow-hidden",
                  isOwned 
                    ? "bg-blue-50/50 border-blue-200 shadow-md" 
                    : "bg-red-50/50 border-dashed border-red-200 shadow-none grayscale-[0.5]"
                )}>
                  <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                    <div className="relative">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                        isOwned ? "bg-blue-600 text-white shadow-lg" : "bg-white text-red-500 shadow-sm border border-red-100"
                      )}>
                        <Icon className="w-8 h-8" />
                      </div>
                      
                      {count > 1 && (
                        <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm font-black text-[9px] leading-none">
                          x{count}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className={cn(
                        "text-[13px] font-black tracking-tight",
                        isOwned ? "text-blue-700" : "text-red-600"
                      )}>
                        {part.name}
                      </h4>
                      <p className={cn(
                        "text-[10px] font-bold leading-tight line-clamp-1",
                        isOwned ? "text-blue-900/60" : "text-red-400"
                      )}>
                        {part.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Hint Card */}
        <Card className="bg-slate-900 rounded-[2rem] p-6 text-white border-none shadow-xl">
          <CardContent className="p-0 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h5 className="text-sm font-black">부품 획득 팁</h5>
              <p className="text-[11px] text-white/60 font-medium leading-relaxed">
                출석체크, 공지사항 확인, 사고 보고 등 <br/>
                적극적인 활동을 통해 부품을 랜덤하게 획득하세요!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
