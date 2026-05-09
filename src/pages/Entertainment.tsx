import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Coins, Trophy, RefreshCw, ChevronRight, Minus, Plus, Flag, Anchor, Waves } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface RouletteSetting {
  id: string;
  label: string;
  multiplier: number;
  probability: number;
  color: string;
}

const DEFAULT_ROULETTE_SETTINGS: RouletteSetting[] = [
  { id: '1', label: '꽝!', multiplier: 0, probability: 0.35, color: '#f8fafc' },
  { id: '2', label: '1배', multiplier: 1, probability: 0.3, color: '#ffffff' },
  { id: '3', label: '2배', multiplier: 2, probability: 0.2, color: '#f8fafc' },
  { id: '4', label: '꽝!', multiplier: 0, probability: 0.1, color: '#ffffff' },
  { id: '5', label: '5배', multiplier: 5, probability: 0.03, color: '#f8fafc' },
  { id: '6', label: '10배', multiplier: 10, probability: 0.02, color: '#ffffff' },
];

export const Entertainment: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('roulette');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [pointsToBet, setPointsToBet] = useState(1);
  const [gameHistory, setGameHistory] = useState<any[]>([]);

  // Snail Race State
  const [selectedSnail, setSelectedSnail] = useState<number | null>(null);
  const [isRacing, setIsRacing] = useState(false);
  const [snailStats, setSnailStats] = useState<any[]>(
    Array(5).fill(0).map(() => ({ pos: 0, status: 'normal', speed: 0 }))
  );
  const [winner, setWinner] = useState<number | null>(null);
  const [snailProbs, setSnailProbs] = useState<number[]>([1, 1, 1, 1, 1]);
  const [isFishing, setIsFishing] = useState(false);
  const [fishingStatus, setFishingStatus] = useState<'idle' | 'casting' | 'waiting' | 'bite' | 'fight' | 'caught' | 'lost' | 'result'>('idle');
  const [fishingResult, setFishingResult] = useState<any>(null);
  const [fishingSettings, setFishingSettings] = useState<any[]>([
    { id: 'small', name: '작은 물고기', multiplier: 2, probability: 0.5, icon: '🐟' },
    { id: 'medium', name: '큰 물고기', multiplier: 5, probability: 0.3, icon: '🐠' },
    { id: 'rare', name: '희귀 고기', multiplier: 20, probability: 0.15, icon: '🐡' },
    { id: 'boss', name: '보스 상어', multiplier: 100, probability: 0.04, icon: '🦈' },
    { id: 'legend', name: '황금 전설 고기', multiplier: 500, probability: 0.01, icon: '👑' }
  ]);
  const [fishingPointsBet, setFishingPointsBet] = useState(1);
  const [lineTension, setLineTension] = useState(0);
  const [fishHealth, setFishHealth] = useState(100);
  const [isReeling, setIsReeling] = useState(false);
  const [targetFish, setTargetFish] = useState<any>(null);
  const [combo, setCombo] = useState(0);
  const [tensionWarning, setTensionWarning] = useState(false);
  const [willEscape, setWillEscape] = useState(false);
  const [fightStartTime, setFightStartTime] = useState<number>(0);
  const [rouletteProbs, setRouletteProbs] = useState<number[]>([0.35, 0.3, 0.2, 0.1, 0.03, 0.02]);

  useEffect(() => {
    if (!profile) return;
    const qGame = query(collection(db, 'lottoHistory'), where('uid', '==', profile.uid), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeGame = onSnapshot(qGame, (snapshot) => {
      setGameHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lottoHistory');
    });

    const unsubscribeProbs = onSnapshot(doc(db, 'settings', 'entertainment'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSnailProbs(data.snailProbabilities || [1, 1, 1, 1, 1]);
        if (data.fishingSettings) {
          setFishingSettings(data.fishingSettings);
        } else if (data.fishingProbabilities) {
          // Migration
          const migrated = [...fishingSettings];
          data.fishingProbabilities.forEach((p: number, i: number) => {
            if (migrated[i]) migrated[i].probability = p;
          });
          setFishingSettings(migrated);
        }
        setRouletteProbs(data.rouletteProbabilities || [0.35, 0.3, 0.2, 0.1, 0.03, 0.02]);
      }
    });

    return () => {
      unsubscribeGame();
      unsubscribeProbs();
    };
  }, [profile]);

  const spinRoulette = async () => {
    if (isSpinning || !profile || pointsToBet <= 0) return;
    if (profile.points < pointsToBet) {
      toast.error('포인트가 부족합니다.');
      return;
    }

    setIsSpinning(true);
    try {
      // Respect probabilities
      const rand = Math.random();
      let cumulativeProb = 0;
      let selectedIdx = 0;
      for (let i = 0; i < DEFAULT_ROULETTE_SETTINGS.length; i++) {
        const prob = rouletteProbs[i] !== undefined ? rouletteProbs[i] : DEFAULT_ROULETTE_SETTINGS[i].probability;
        cumulativeProb += prob;
        if (rand <= cumulativeProb) {
          selectedIdx = i;
          break;
        }
      }
      
      const selected = DEFAULT_ROULETTE_SETTINGS[selectedIdx];
      const segmentAngle = 360 / DEFAULT_ROULETTE_SETTINGS.length;
      
      // Absolute target angle relative to 0 that brings segment to the top
      // Segment 0 is at -90 in SVG. Center of segment i is i*angle - 90 + angle/2.
      // To bring this to -90: (i * angle - 90 + angle/2) + Rotation = -90 => Rotation = - (i * angle + angle/2)
      const targetRotationOffset = 360 - (selectedIdx * segmentAngle + segmentAngle / 2);
      
      const randomNoise = (Math.random() - 0.5) * (segmentAngle * 0.6); // 60% of segment width
      const totalNewRotation = Math.ceil(rotation / 360) * 360 + (360 * 10) + targetRotationOffset + randomNoise;
      
      setRotation(totalNewRotation);

      setTimeout(async () => {
        setIsSpinning(false);
        const winPoints = Math.floor(pointsToBet * selected.multiplier);
        const pointDiff = winPoints - pointsToBet;

        await updateDoc(doc(db, 'users', profile.uid), {
          points: increment(pointDiff)
        });

        await addDoc(collection(db, 'lottoHistory'), {
          uid: profile.uid,
          type: 'ROULETTE',
          label: selected.label,
          betPoints: pointsToBet,
          winPoints: winPoints,
          createdAt: new Date().toISOString()
        });

        if (winPoints > 0) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          toast.success(`${selected.label} 당첨! ${winPoints}P 획득!`);
        } else {
          toast.error('꽝! 다음 기회에...');
        }
      }, 7000); 
    } catch (error) {
      setIsSpinning(false);
      toast.error('오류가 발생했습니다.');
    }
  };

  const startSnailRace = async () => {
    if (isRacing || selectedSnail === null || pointsToBet <= 0 || !profile) return;
    if (profile.points < pointsToBet) {
      toast.error('포인트가 부족합니다.');
      return;
    }

    setIsRacing(true);
    setWinner(null);
    
    const initialStats = Array(5).fill(0).map((_, i) => ({ 
      pos: 0, 
      status: 'normal', 
      speed: (Math.random() * 0.08 + 0.04), // Slow base speed for ~15-20s race
    }));
    setSnailStats(initialStats);

    const startTime = Date.now();
    let currentStats = [...initialStats];

    const updateRace = () => {
      let isDone = false;
      let winnerIdx = -1;

      const nextStats = currentStats.map((snail, i) => {
        if (isDone || snail.pos >= 100) return snail;

        let moveAmount = 0;
        let nextStatus = snail.status;

        // Status logic
        if (snail.status === 'normal') {
          if (Math.random() < 0.005 && snail.pos > 10 && snail.pos < 90) {
            const dice = Math.random();
            if (dice < 0.3) nextStatus = 'sleeping';
            else if (dice < 0.6) nextStatus = 'eating';
            else nextStatus = 'tired';
            
            // Auto recovery after delay
            setTimeout(() => {
              setSnailStats(prev => {
                const updated = [...prev];
                if (updated[i]) updated[i].status = 'normal';
                return updated;
              });
              currentStats[i].status = 'normal';
            }, 2000 + Math.random() * 3000);
          }
          moveAmount = (Math.random() * 0.15 + 0.05) * (snailProbs[i] || 1);
        } else if (snail.status === 'tired') {
          moveAmount = Math.random() * 0.04;
        } else if (snail.status === 'eating') {
          moveAmount = -0.02;
        } else {
          moveAmount = 0; // sleeping
        }

        const nextPos = Math.max(0, Math.min(100, snail.pos + moveAmount));
        if (nextPos >= 100 && !isDone) {
          isDone = true;
          winnerIdx = i;
        }

        return { ...snail, pos: nextPos, status: nextStatus };
      });

      currentStats = nextStats;
      setSnailStats(nextStats);

      if (!isDone) {
        requestAnimationFrame(updateRace);
      } else {
        setTimeout(() => handleRaceEnd(winnerIdx), 800);
      }
    };

    // Slight delay before race starts for anticipation
    setTimeout(() => {
      requestAnimationFrame(updateRace);
    }, 1000);
  };

  const handleRaceEnd = async (winningSnail: number) => {
    setWinner(winningSnail);
    setIsRacing(false);
    
    if (!profile) return;

    const isWin = winningSnail === selectedSnail;
    const winPoints = isWin ? pointsToBet * 5 : 0; // 5 snails so 5x reward
    const pointDiff = winPoints - pointsToBet;

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        points: increment(pointDiff)
      });

      await addDoc(collection(db, 'lottoHistory'), {
        uid: profile.uid,
        type: 'SNAIL_RACE',
        label: `달팽이 ${winningSnail + 1}번 승리`,
        betPoints: pointsToBet,
        winPoints: winPoints,
        createdAt: new Date().toISOString()
      });

      if (isWin) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        toast.success(`축하합니다! ${winningSnail + 1}번 달팽이가 승리하여 ${winPoints}P를 획득했습니다!`);
      } else {
        toast.error(`${winningSnail + 1}번 달팽이가 승리했습니다. 아쉽네요!`);
      }
    } catch (error) {
      toast.error('결과 저장 중 오류가 발생했습니다.');
    }
  };

  // Fishing Game Effect Loop
  useEffect(() => {
    if (fishingStatus !== 'fight') return;

    const interval = setInterval(() => {
      let nextTension = 0;
      let timeInFight = Date.now() - fightStartTime;

      setLineTension(prev => {
        let tension = prev;
        if (isReeling) {
          tension += 7.0; // Slightly slower for better control
        } else {
          tension -= 4.0;
        }
        
        const rarityMultiplier = targetFish?.multiplier ? Math.max(1, targetFish.multiplier / 20) : 1;
        const randomPull = (Math.random() - 0.3) * (6 + rarityMultiplier * 4);
        tension += randomPull;

        if (tension >= 100) {
          handleFishingFail('LINE_BREAK');
          return 100;
        }
        if (tension <= 0) tension = 0;
        nextTension = tension;
        return tension;
      });

      setFishHealth(prev => {
        if (isReeling) {
          // Early Failure Logic: 70% of fishes are pre-determined to escape
          if (timeInFight < 4000 && willEscape && Math.random() < 0.15) {
            handleFishingFail('ESCAPE');
            return prev;
          }

          // Damage logic: Optimal zone 45-75
          const isOptimal = nextTension > 45 && nextTension < 75;
          const tensionFactor = isOptimal ? 3.0 : 0.2; 
          
          if (isOptimal) setCombo(c => Math.min(100, c + 3));
          else setCombo(c => Math.max(0, c - 6));

          const damage = (Math.random() * 2.0 + 1.0) * tensionFactor * (1 + (combo / 50));
          const nextHealth = prev - damage;
          
          if (nextHealth <= 0) {
            handleFishingSuccess();
            return 0;
          }
          return nextHealth;
        } else {
          setCombo(c => Math.max(0, c - 3));
          return Math.min(100, prev + 0.2);
        }
      });

      setTensionWarning(nextTension > 75);
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [fishingStatus, isReeling, targetFish, combo, willEscape, fightStartTime]);

  const startFishing = async () => {
    if (isFishing || !profile || fishingPointsBet <= 0) return;
    if (profile.points < fishingPointsBet) {
      toast.error('포인트가 부족합니다.');
      return;
    }

    setIsFishing(true);
    setFishingStatus('casting');
    setFishingResult(null);
    setLineTension(0);
    setFishHealth(100);
    setCombo(0);
    setWillEscape(Math.random() < 0.7); // 70% of fishes are "destined" to escape

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        points: increment(-fishingPointsBet)
      });

      // Casting (1s)
      setTimeout(() => setFishingStatus('waiting'), 1000);

      // Waiting (3-7s)
      const waitTime = 3000 + Math.random() * 4000;
      setTimeout(() => {
        setFishingStatus('bite');

        // Select the fish right now
        const rand = Math.random();
        let cumulative = 0;
        let selected = fishingSettings[0];
        for (const fish of fishingSettings) {
          cumulative += fish.probability;
          if (rand <= cumulative) {
            selected = fish;
            break;
          }
        }
        setTargetFish(selected);

        // Transition to fight after 1.5s
        setTimeout(() => {
          setFishingStatus(current => {
            if (current === 'bite') {
              setFightStartTime(Date.now());
              return 'fight';
            }
            return current;
          });
        }, 1500);
      }, waitTime);

    } catch (e) {
      setIsFishing(false);
      setFishingStatus('idle');
      toast.error('오류가 발생했습니다.');
    }
  };

  const handleFishingSuccess = async () => {
    if (fishingStatus !== 'fight' || !profile || !targetFish) return;

    setFishingStatus('caught');
    const winPoints = fishingPointsBet * targetFish.multiplier;

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        points: increment(winPoints)
      });

      setFishingResult({ ...targetFish, winPoints });
      
      setTimeout(() => {
        setFishingStatus('result');
        setIsFishing(false);
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        toast.success(`${targetFish.name}을(를) 낚았습니다! ${winPoints.toLocaleString()}P 획득!`);
      }, 2000);

      await addDoc(collection(db, 'lottoHistory'), {
        uid: profile.uid,
        type: 'FISHING',
        label: `${targetFish.name} 포획`,
        betPoints: fishingPointsBet,
        winPoints: winPoints,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      toast.error('결과 처리 중 오류 발생');
    }
  };

  const handleFishingFail = async (reason: 'LINE_BREAK' | 'ESCAPE') => {
    setFishingStatus('lost');
    setIsFishing(false);
    setFishingResult({ label: reason === 'LINE_BREAK' ? '줄이 끊어졌습니다!' : '물고기가 도망갔습니다!', winPoints: 0 });
    
    toast.error(reason === 'LINE_BREAK' ? '아뿔싸! 줄이 견디지 못하고 끊어졌습니다.' : '물고기가 힘을 써서 도망갔습니다.');
    
    setTimeout(() => {
      setFishingStatus('result');
    }, 2000);

    await addDoc(collection(db, 'lottoHistory'), {
      uid: profile?.uid,
      type: 'FISHING',
      label: '낚시 실패',
      betPoints: fishingPointsBet,
      winPoints: 0,
      createdAt: new Date().toISOString()
    });
  };


  return (
    <div className="space-y-6 pb-24 px-1 text-white">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(3); opacity: 0; }
        }
        .ripple-effect {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.4);
          animation: ripple 2s infinite;
        }
        @keyframes drift {
          from { transform: translateX(-10%); }
          to { transform: translateX(10%); }
        }
        .water-animation {
          animation: drift 10s ease-in-out infinite alternate;
        }
      `}} />
      <header className="py-8 text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight italic drop-shadow-lg uppercase">건명 놀이터</h2>
        <p className="text-[10px] font-black text-primary tracking-[0.3em] uppercase">프리미엄 아케이드</p>
      </header>

      <div className="bg-card p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-4 text-center shadow-xl">
         <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20">
            <Coins className="w-6 h-6 text-yellow-500" />
         </div>
         <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">CURRENT BALANCE</p>
            <p className="text-4xl font-black italic text-white leading-none">{profile?.points?.toLocaleString() || 0} <span className="text-xl text-yellow-500 not-italic">P</span></p>
         </div>
      </div>

      <div className="bg-card p-1.5 rounded-3xl flex gap-2 border border-white/5 shadow-2xl relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
         {[
           {id:'roulette', label:'행운의 선물 룰렛'},
           {id:'snail', label:'건명 달팽이 레이싱'},
           {id:'fishing', label:'건명 강태공 낚시'}
         ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => {
                if(isSpinning || isRacing || isFishing) return;
                setActiveTab(tab.id);
              }} 
              className={cn(
                "flex-1 h-12 rounded-2xl text-[11px] font-black transition-all relative z-10", 
                activeTab === tab.id ? "bg-white text-black shadow-xl scale-[1.02]" : "text-muted-foreground hover:text-white"
            )}
          >
             {tab.label}
          </button>
       ))}
    </div>

    <div className="min-h-[460px]">
       <AnimatePresence mode="wait">
          {activeTab === 'roulette' && (
            <motion.div key="roulette" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6 flex flex-col items-center pt-2">
               {/* Roulette Board Background */}
               <div className="relative w-full max-w-sm bg-[#1e293b] rounded-[3rem] p-8 pb-12 shadow-2xl border-b-8 border-black overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                  
                  {/* Header in the board */}
                  <div className="relative z-10 text-center mb-8 flex flex-col items-center gap-1">
                     <div className="flex gap-1 mb-2">
                        {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                     </div>
                     <h3 className="text-2xl font-black text-white italic tracking-tighter drop-shadow-lg uppercase leading-none">건명 행운의 포인트 룰렛</h3>
                     <p className="text-[9px] font-black text-yellow-400 tracking-[0.3em] uppercase">Kunmyung Lucky Point</p>
                  </div>

                  <div className="relative flex items-center justify-center pt-4" style={{ perspective: '1200px' }}>
                     {/* Shadow below wheel */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-black/40 blur-2xl rounded-full" />
                     
                     {/* The Wheel */}
                     <motion.div 
                       className="w-72 h-72 rounded-full relative z-10 shadow-2xl border-[10px] border-[#3182f6]" 
                       style={{ transformStyle: 'preserve-3d', background: '#3182f6' }}
                       animate={{ rotate: rotation }} 
                       transition={{ 
                         rotate: { 
                           duration: 7, 
                           ease: [0.15, 0, 0.05, 1],
                           type: "spring",
                           stiffness: 15,
                           damping: 8,
                           mass: 1.2
                         } 
                       }}
                     >
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                           {DEFAULT_ROULETTE_SETTINGS.map((s, i) => {
                              const angle = 360 / DEFAULT_ROULETTE_SETTINGS.length;
                              const sAngle = i * angle - 90;
                              const eAngle = (i + 1) * angle - 90;
                              const x1 = 50 + 50 * Math.cos((Math.PI * sAngle) / 180);
                              const y1 = 50 + 50 * Math.sin((Math.PI * sAngle) / 180);
                              const x2 = 50 + 50 * Math.cos((Math.PI * eAngle) / 180);
                              const y2 = 50 + 50 * Math.sin((Math.PI * eAngle) / 180);
                              return (
                                <g key={s.id}>
                                   <path d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`} fill={s.color} stroke="#3182f6" strokeWidth="1" />
                                   <text 
                                     x="50" y="16" 
                                     transform={`rotate(${sAngle + angle/2 + 90}, 50, 50)`} 
                                     fill={s.label === '꽝!' ? '#ef4444' : '#1e293b'} 
                                     className="text-[5px] font-black uppercase tracking-tighter" 
                                     textAnchor="middle"
                                   >
                                      {s.label}
                                   </text>
                                </g>
                              );
                           })}
                           
                           {/* Small dot lights on the border */}
                           {[...Array(12)].map((_, i) => {
                             const dotAngle = i * (360/12);
                             const dx = 50 + 47 * Math.cos((Math.PI * dotAngle) / 180);
                             const dy = 50 + 47 * Math.sin((Math.PI * dotAngle) / 180);
                             return <circle key={i} cx={dx} cy={dy} r="2" fill="white" className="animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />;
                           })}
                        </svg>

                        {/* Center START Button */}
                        <div className="absolute inset-0 flex items-center justify-center">
                           <button 
                             onClick={spinRoulette}
                             disabled={isSpinning}
                             className={cn(
                               "w-16 h-16 rounded-full bg-rose-500 border-4 border-white shadow-xl flex items-center justify-center transition-all active:scale-90",
                               isSpinning ? "opacity-50 grayscale" : "hover:scale-105"
                             )}
                           >
                              <span className="text-[10px] font-black text-white italic drop-shadow-md">START!</span>
                           </button>
                        </div>
                     </motion.div>

                     {/* Top Pointer */}
                     <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                        <motion.div 
                          className="w-8 h-10 bg-rose-500 border-2 border-white rounded-t-full rounded-b-2xl shadow-xl flex flex-col items-center justify-start pt-1"
                          animate={{ rotate: isSpinning ? [-2, 2, -2] : 0 }}
                          transition={{ repeat: Infinity, duration: 0.1 }}
                        >
                           <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        </motion.div>
                     </div>
                  </div>

                  <div className="relative z-10 mt-12 flex flex-col items-center gap-4">
                     <div className="flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/5 w-full">
                        <Button variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white/10" onClick={() => setPointsToBet(Math.max(1, pointsToBet - 10))} disabled={isSpinning}><Minus className="w-4 h-4" /></Button>
                        <div className="flex-1 text-center">
                           <p className="text-[8px] font-bold text-white/40 uppercase mb-0.5">BETTING AMOUNT</p>
                           <Input value={pointsToBet} readOnly className="h-8 border-none bg-transparent text-lg font-black text-center p-0 focus-visible:ring-0" />
                        </div>
                        <Button variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white/10" onClick={() => setPointsToBet(pointsToBet + 10)} disabled={isSpinning}><Plus className="w-4 h-4" /></Button>
                     </div>
                     
                     <p className="text-[10px] font-black text-white/40 italic">돌릴 때마다 행운이 찾아옵니다! 지금 바로 START를 누르세요.</p>
                  </div>
               </div>
            </motion.div>
          )}

            {activeTab === 'snail' && (
              <motion.div key="snail" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-6 pt-4">
                 <div className="relative bg-[#4a6b22] rounded-[2.5rem] border-4 border-[#3a2a1a] shadow-2xl overflow-hidden min-h-[400px]">
                    {/* Forest Background overlay */}
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-60 mix-blend-overlay" />
                    
                    {/* Header Board */}
                    <div className="relative z-20 flex justify-center pt-4 pb-2">
                       <div className="bg-[#5c4033] border-4 border-[#3a2a1a] px-8 py-3 rounded-xl shadow-lg transform -rotate-1">
                          <h3 className="text-xl md:text-2xl font-black text-[#fef3c7] drop-shadow-[0_2px_0_rgba(0,0,0,1)] uppercase tracking-tighter">
                             건명 달팽이 레이싱 게임
                          </h3>
                       </div>
                    </div>

                    <div className="relative px-4 pb-8 space-y-3 mt-4">
                       {/* Finish line */}
                       <div className="absolute right-12 top-0 bottom-0 w-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-white/20 border-x border-black/20 z-10" />
                       
                       {[0, 1, 2, 3, 4].map(idx => {
                         const snailNames = ['건', '명', '안', '전', '승'];
                         const snailColors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-rose-500'];
                         
                         return (
                           <div key={idx} className="relative h-14 md:h-16 flex flex-col justify-center">
                              {/* Track */}
                              <div className="absolute inset-0 bg-[#3d2b1f]/40 border-b border-white/5 rounded-lg" />
                              
                              <motion.div 
                                animate={{ x: `${snailStats[idx]?.pos}%` }} 
                                className="absolute z-20 left-0 right-16 flex items-center gap-2"
                              >
                                 <div className="flex flex-col items-center">
                                    <div className={cn(
                                      "w-10 h-10 md:w-12 md:h-12 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-lg font-black text-white relative",
                                      snailColors[idx],
                                      winner === idx && "ring-4 ring-yellow-400 animate-pulse scale-110",
                                      snailStats[idx]?.status === 'sleeping' && "grayscale opacity-50"
                                    )}>
                                       {snailNames[idx]}
                                       <div className="absolute -right-2 top-0 text-xl overflow-visible">🐌</div>
                                    </div>
                                    
                                    {/* Progress badge */}
                                    <div className="mt-1 bg-black/60 rounded px-1.5 py-0.5 border border-white/10">
                                       <p className="text-[8px] font-black text-white tracking-tighter">{(snailStats[idx]?.pos || 0).toFixed(2)}%</p>
                                    </div>
                                 </div>

                                 <AnimatePresence>
                                   {snailStats[idx]?.status === 'sleeping' && (
                                     <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 10 }} exit={{ opacity: 0 }} className="text-sm">💤</motion.div>
                                   )}
                                   {snailStats[idx]?.status === 'eating' && (
                                     <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1, x: 10 }} exit={{ opacity: 0 }} className="text-lg">🥬</motion.div>
                                   )}
                                 </AnimatePresence>
                              </motion.div>
                           </div>
                         );
                       })}
                    </div>

                    {!isRacing && winner === null && (
                      <div className="absolute inset-0 flex items-center justify-center z-30 px-6">
                        <div className="bg-[#fef3c7] border-8 border-[#5c4033] p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center transform scale-90">
                           <h4 className="text-[#5c4033] font-black text-lg mb-2 border-b-2 border-[#5c4033]/20 pb-1">레이싱 진행정보</h4>
                           <p className="text-[#5c4033]/80 text-[10px] font-bold leading-tight">
                              원하시는 달팽이를 선택하고 배팅 버튼을 눌러주세요!<br/>
                              1등 도착 시 배팅액의 <span className="text-red-600 font-black">5배</span>를 획득합니다.
                           </p>
                        </div>
                      </div>
                    )}
                 </div>

                 <div className="grid grid-cols-5 gap-2">
                    {[0, 1, 2, 3, 4].map(idx => {
                      const snailNames = ['건', '명', '안', '전', '승'];
                      const snailColors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-rose-500'];
                      
                      return (
                        <button 
                          key={idx} 
                          onClick={() => !isRacing && setSelectedSnail(idx)} 
                          className={cn(
                            "p-3 rounded-xl border-4 transition-all text-center flex flex-col items-center gap-1.5", 
                            selectedSnail === idx 
                              ? "bg-white border-[#5c4033] text-[#5c4033] shadow-xl scale-105 z-10" 
                              : "bg-white/5 border-transparent opacity-40 hover:opacity-100"
                          )}
                        >
                          <div className={cn("w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-black text-white", snailColors[idx])}>{snailNames[idx]}</div>
                          <div className="text-[9px] font-black">{idx + 1}호</div>
                        </button>
                      );
                    })}
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                       <Button variant="ghost" className="h-14 w-14 rounded-xl bg-white/5" onClick={() => setPointsToBet(Math.max(1, pointsToBet - 10))} disabled={isRacing}><Minus/></Button>
                       <Input value={pointsToBet} readOnly className="h-14 text-center font-black bg-slate-900 border-white/5 rounded-xl flex-1 text-primary" />
                       <Button variant="ghost" className="h-14 w-14 rounded-xl bg-white/5" onClick={() => setPointsToBet(pointsToBet + 10)} disabled={isRacing}><Plus/></Button>
                    </div>
                    <Button 
                      onClick={startSnailRace} 
                      disabled={isRacing || selectedSnail === null} 
                      className={cn(
                        "w-full h-16 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-95",
                        isRacing ? "bg-white/10 text-white/50" : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20"
                      )}
                    >
                      {isRacing ? '레이스 광란의 질주 중!' : '내 달팽이 배팅하기 (5배)'}
                    </Button>
                    <p className="text-[10px] text-center font-black text-white/20 uppercase tracking-widest italic">다섯 마리의 달팽이가 보여주는 10초간의 긴박한 드라마!</p>
                 </div>
              </motion.div>
            )}

            {activeTab === 'fishing' && (
            <motion.div key="fishing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-6 pt-4 h-full">
               <div className="relative h-[500px] bg-[#0ea5e9] rounded-[3rem] border-8 border-[#3a2a1a] shadow-2xl overflow-hidden group select-none">
                  {/* Immersive Background */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ 
                      backgroundImage: 'url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1200")',
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                  
                  {/* Water Overlay - More subtle */}
                  <div className="absolute inset-0 bg-blue-500/5 backdrop-blur-[0.5px]" />
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-blue-900/10 to-transparent" />

                  {/* UI: Tension Bar (Top) */}
                  <AnimatePresence>
                     {fishingStatus === 'fight' && (
                        <motion.div 
                          initial={{ y: -50, opacity: 0 }} 
                          animate={{ y: 20, opacity: 1 }} 
                          exit={{ y: -100, opacity: 0 }}
                          className="absolute top-4 inset-x-8 z-30"
                        >
                           <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full p-1 shadow-2xl">
                              <div className="relative h-5 w-full bg-white/5 rounded-full overflow-hidden">
                                 <motion.div 
                                   className={cn(
                                     "h-full transition-colors duration-200",
                                     lineTension > 70 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : lineTension > 50 && lineTension < 70 ? "bg-emerald-400" : "bg-yellow-400"
                                   )}
                                   style={{ width: `${lineTension}%` }}
                                 />
                                 {/* Optimal Zone Marker */}
                                 <div className="absolute inset-y-0 left-[50%] right-[30%] bg-emerald-500/30 border-x border-white/20" />
                              </div>
                              <div className="flex justify-between px-4 mt-1.5">
                                 <span className="text-[9px] font-black text-white/50 tracking-tighter italic">릴 텐션 (TENSION)</span>
                                 <span className={cn("text-[9px] font-black italic tracking-tighter", lineTension > 70 ? "text-red-400 animate-pulse" : "text-emerald-400")}>
                                    {lineTension > 70 ? "줄 끊어짐 위험!" : lineTension > 50 ? "좋아요! 유지하세요" : "조금 더 당기세요"}
                                 </span>
                              </div>
                          </div>
                       </motion.div>
                    )}
                 </AnimatePresence>

                  {/* UI: Fish HP (Top Left - Clear of Reel Button) */}
                  <AnimatePresence>
                     {fishingStatus === 'fight' && (
                        <motion.div 
                          initial={{ x: -100, opacity: 0 }}
                          animate={{ x: 20, opacity: 1 }}
                          className="absolute top-24 left-4 z-40 pointer-events-none w-36"
                        >
                           <div className="bg-black/90 backdrop-blur-xl rounded-2xl p-3 border border-white/10 shadow-2xl">
                              <div className="flex items-center gap-3 mb-2">
                                 <div className="text-3xl animate-bounce">
                                    {targetFish?.icon || '🐟'}
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-white italic tracking-tight truncate uppercase">{targetFish?.name || '목표'}</span>
                                    <span className="text-[7px] font-bold text-red-500 tracking-[0.2em] uppercase">Energy Gauge</span>
                                 </div>
                              </div>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                 <motion.div 
                                   className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-red-400" 
                                   style={{ width: `${fishHealth}%` }} 
                                 />
                              </div>
                              <div className="mt-1 flex justify-between items-center">
                                 <span className="text-[7px] font-bold text-white/20">STATUS: FIGHTING</span>
                                 <span className="text-[10px] font-black text-white/60 italic">{Math.ceil(fishHealth)}%</span>
                              </div>
                           </div>
                        </motion.div>
                     )}
                  </AnimatePresence>

                  <div className="relative z-10 h-full flex flex-col items-center justify-center">
                     <AnimatePresence mode="wait">
                        {fishingStatus === 'idle' && (
                          <motion.div key="idle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center space-y-4">
                             <div className="w-32 h-32 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border-4 border-white/20 mb-2 mx-auto shadow-2xl">
                                <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 4 }}>
                                   <Anchor className="w-16 h-16 text-white" />
                                </motion.div>
                             </div>
                             <div className="space-y-1">
                                <h3 className="text-2xl font-black text-white italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] uppercase">월척을 낚아보세요!</h3>
                                <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest drop-shadow-md">최고의 낚시 포인트 발견</p>
                             </div>
                          </motion.div>
                        )}

                        {fishingStatus === 'casting' && (
                          <motion.div key="casting" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} className="flex flex-col items-center gap-4">
                             <div className="text-9xl filter drop-shadow-2xl">🎣</div>
                             <p className="text-white font-black italic animate-pulse text-xl drop-shadow-md">캐스팅 중...</p>
                          </motion.div>
                        )}

                        {fishingStatus === 'waiting' && (
                          <motion.div key="waiting" className="flex flex-col items-center gap-6">
                             <div className="relative">
                                <motion.div animate={{ rotate: [0, -2, 2, 0], y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
                                   <div className="text-9xl grayscale opacity-80 filter drop-shadow-2xl">🛶</div>
                                </motion.div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
                                   {[0,1,2].map(i => (
                                     <motion.div 
                                       key={i}
                                       className="w-4 h-4 bg-white/40 rounded-full"
                                       animate={{ scale: [1, 2], opacity: [1, 0] }}
                                       transition={{ repeat: Infinity, duration: 2, delay: i * 0.4 }}
                                     />
                                   ))}
                                </div>
                             </div>
                             <p className="text-white font-black italic tracking-[0.4em] uppercase text-xs drop-shadow-md animate-pulse">입질을 기다리는 중...</p>
                          </motion.div>
                        )}

                        {fishingStatus === 'bite' && (
                          <motion.div key="bite" className="relative flex flex-col items-center gap-4">
                             <motion.div 
                               initial={{ scale: 0, opacity: 1 }}
                               animate={{ scale: [0, 3], opacity: [1, 0] }}
                               transition={{ repeat: Infinity, duration: 0.8 }}
                               className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-8 border-white/60 rounded-full"
                             />
                             <motion.div animate={{ scale: [1, 1.5, 1], y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 0.1 }} className="relative z-10">
                                <div className="text-9xl filter drop-shadow-[0_0_40px_rgba(255,255,0,0.8)]">❗</div>
                             </motion.div>
                             <div className="bg-black/60 backdrop-blur-xl px-8 py-2 rounded-2xl border border-white/20">
                                <p className="text-yellow-400 font-black text-4xl drop-shadow-lg italic uppercase animate-bounce">물었다!!!</p>
                             </div>
                          </motion.div>
                        )}

                        {(fishingStatus === 'caught' || fishingStatus === 'lost') && (
                          <motion.div key="transition" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                             <div className="text-9xl mb-4">
                                {fishingStatus === 'caught' ? '🎖️' : '🌪️'}
                             </div>
                             <h4 className="text-4xl font-black text-white italic drop-shadow-2xl uppercase">
                                {fishingStatus === 'caught' ? '포획 성공!' : '도망갔습니다!'}
                             </h4>
                          </motion.div>
                        )}

                        {fishingStatus === 'result' && fishingResult && (
                          <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-6 bg-black/60 backdrop-blur-3xl p-10 rounded-[3rem] border-2 border-white/20 shadow-2xl mx-4 w-72">
                             <motion.div 
                               animate={{ y: [-15, 15, -15], rotate: [-10, 10, -10], scale: [1, 1.1, 1] }} 
                               transition={{ repeat: Infinity, duration: 3 }} 
                               className="text-9xl filter drop-shadow-[0_0_40px_rgba(255,255,255,0.8)]"
                             >
                                {fishingResult.icon || '🐟'}
                             </motion.div>
                             <div className="text-center space-y-2">
                                <h5 className="text-emerald-400 font-black text-sm uppercase tracking-widest">{fishingResult.name}</h5>
                                <h4 className="text-white font-black text-5xl italic tracking-tighter drop-shadow-md leading-none">
                                   {fishingResult.winPoints > 0 ? `+${fishingResult.winPoints.toLocaleString()}` : '0'}
                                   <span className="text-xl text-yellow-500 not-italic ml-1">P</span>
                                </h4>
                             </div>
                             <Button onClick={() => setFishingStatus('idle')} className="w-full bg-white text-black font-black rounded-2xl h-14 text-lg hover:scale-105 active:scale-95 transition-all shadow-xl">확인</Button>
                          </motion.div>
                        )}
                     </AnimatePresence>
                  </div>

                  {/* UI: Reel Button & Rod (Fight Phase Only) */}
                  <AnimatePresence>
                    {fishingStatus === 'fight' && (
                      <>
                        {/* Professional Fishing Rod (Silver/Carbon Hybrid) */}
                        <motion.div 
                          initial={{ y: 200, rotate: -15 }}
                          animate={{ 
                            y: 0,
                            rotate: isReeling ? -35 : -15,
                            scale: isReeling ? 1.05 : 1,
                            x: isReeling ? -10 : 0
                          }}
                          className="absolute bottom-[-120px] left-[-60px] z-20 pointer-events-none"
                        >
                          <div className="relative origin-bottom">
                             {/* High Precision Carbon Fiber Rod */}
                             <div className="w-5 h-[800px] bg-gradient-to-t from-[#111] via-[#222] to-[#eee] rounded-full border-x-2 border-white/10 transform rotate-12 origin-bottom shadow-2xl relative overflow-hidden" 
                                  style={{ clipPath: 'polygon(48% 0%, 52% 0%, 100% 100%, 0% 100%)' }}>
                                 {/* Metallic Shine */}
                                 <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/40 blur-[1px]" />
                                 <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                             </div>

                             {/* Red/Gold Bindings for Guides */}
                             {[250, 400, 530, 630, 710, 770].map((pos, i) => (
                               <div 
                                 key={i}
                                 className="absolute left-[85%] -translate-x-1/2 w-8 h-4"
                                 style={{ bottom: `${pos}px`, transform: `rotate(12deg) scale(${1 - i*0.15})` }}
                               >
                                  {/* Binding detail */}
                                  <div className="absolute inset-x-0 top-1.5 h-1 bg-red-600 border-y border-yellow-500/50" />
                                  <div className="w-8 h-8 rounded-full border-[3.5px] border-slate-900 bg-transparent flex items-center justify-center shadow-lg">
                                     <div className="w-5 h-5 rounded-full border border-blue-300/30 ring-1 ring-white/10" />
                                  </div>
                               </div>
                             ))}

                             {/* Handle Area (Premium Grips) */}
                             <div className="absolute bottom-0 left-[10%] w-14 h-64 z-10">
                                {/* Bottom Grip (EVA Foam) */}
                                <div className="absolute bottom-0 inset-x-0 h-32 bg-slate-900 border-x-4 border-slate-800 rounded-b-3xl" />
                                {/* Cork Middle */}
                                <div className="absolute bottom-32 inset-x-0 h-20 bg-[#d2b48c] border-x-4 border-[#8b4513]/30" />
                                {/* Top Reel Seat */}
                                <div className="absolute bottom-52 inset-x-0 h-12 bg-slate-800 border-b-2 border-yellow-600/50" />
                             </div>
                             
                             {/* High Detail Baitcast Reel */}
                             <motion.div 
                               className="absolute bottom-45 left-[25%] w-24 h-20 bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-xl border-4 border-slate-700 shadow-2xl z-30"
                               animate={{ rotateX: isReeling ? [0, 5, 0] : 0 }}
                             >
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-yellow-600/20 rounded-full border border-yellow-500/30" />
                                <motion.div 
                                  className="absolute top-2 right-2 w-12 h-12"
                                  animate={{ rotate: isReeling ? 720 : 0 }}
                                  transition={{ repeat: Infinity, duration: 0.4, ease: "linear" }}
                                >
                                   <div className="w-full h-full border-4 border-slate-400 rounded-full flex items-center justify-center">
                                      <div className="w-2 h-10 bg-slate-500 rounded-full" />
                                   </div>
                                </motion.div>
                             </motion.div>
                             
                             {/* High Visibility Fluorocarbon Line */}
                             <motion.div 
                               className="absolute top-0 left-[90%] w-[1.5px] bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)] origin-top"
                               animate={{ 
                                 height: isReeling ? [140, 240, 140] : 140,
                                 rotate: isReeling ? [-12, 12, -12] : 0
                               }}
                               style={{ transform: 'rotate(12deg)' }}
                             />
                          </div>
                        </motion.div>

                        {/* Reel Button */}
                        <motion.div 
                          initial={{ scale: 0, x: 100 }}
                          animate={{ scale: 1, x: 0 }}
                          exit={{ scale: 0, x: 100 }}
                          className="absolute bottom-10 right-8 z-40"
                        >
                           <button
                             onPointerDown={() => setIsReeling(true)}
                             onPointerUp={() => setIsReeling(false)}
                             onPointerLeave={() => setIsReeling(false)}
                             className={cn(
                               "w-36 h-36 rounded-full border-[10px] border-black/60 p-2 shadow-2xl transition-all active:scale-90",
                               isReeling ? "bg-orange-700 scale-95" : "bg-orange-600 hover:scale-105"
                             )}
                           >
                              <div className="w-full h-full rounded-full border-4 border-white/20 flex items-center justify-center flex-col">
                                 <motion.div animate={{ rotate: isReeling ? 360 : 0 }} transition={{ repeat: Infinity, duration: 0.3, ease: "linear" }}>
                                    <RefreshCw className="w-12 h-12 text-white mb-1" />
                                 </motion.div>
                                 <span className="text-white font-black text-sm italic tracking-tighter">릴 감기</span>
                              </div>
                           </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
               </div>

               <div className="space-y-6">
                  {/* Bet Selection */}
                  {!isFishing && (
                     <div className="bg-black/20 p-2 rounded-3xl border border-white/5 flex gap-2">
                        {[1, 10, 50, 100, 500].map(points => (
                           <button
                             key={points}
                             onClick={() => setFishingPointsBet(points)}
                             className={cn(
                               "flex-1 h-10 rounded-2xl text-xs font-black transition-all",
                               fishingPointsBet === points ? "bg-primary text-white shadow-lg" : "text-white/40 hover:text-white"
                             )}
                           >
                              {points}
                           </button>
                        ))}
                     </div>
                  )}

                  <div className="bg-slate-900/60 p-5 rounded-3xl border border-white/5 flex justify-between items-center shadow-xl backdrop-blur-xl">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
                           <Waves className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">현재 포인트</p>
                           <p className="text-2xl font-black text-white italic leading-none">{profile?.points?.toLocaleString() || 0} <span className="text-[10px] text-emerald-400 not-italic uppercase ml-1">P</span></p>
                        </div>
                     </div>
                     <Button 
                       onClick={startFishing} 
                       disabled={isFishing}
                       className={cn(
                         "h-16 px-10 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-95 group relative overflow-hidden",
                         isFishing ? "bg-white/5 text-white/20 cursor-not-allowed" : "bg-white text-black hover:bg-emerald-50 scale-105"
                       )}
                     >
                        {isFishing ? (
                           <div className="flex items-center gap-2">
                             <RefreshCw className="w-5 h-5 animate-spin" />
                             <span>진행 중</span>
                           </div>
                        ) : (
                           <div className="flex flex-col items-center">
                              <span className="leading-none">캐스팅!</span>
                              <span className="text-[9px] font-bold text-black/40">-{fishingPointsBet} 포인트</span>
                           </div>
                        )}
                        {!isFishing && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />}
                     </Button>
                  </div>
                  <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                    <p className="text-[10px] text-center font-black text-emerald-500/60 uppercase tracking-[0.2em] italic leading-relaxed">
                       팁: 릴링 중 텐션 게이지를 <span className="text-emerald-400 underline underline-offset-4">초록색 영역</span>에 유지하면 콤보가 쌓여 더 큰 데미지를 줍니다!
                    </p>
                  </div>
               </div>
            </motion.div>
          )}
         </AnimatePresence>
      </div>

      <div className="space-y-4 pt-4">
         <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">최근 행운 내역</h4>
         <div className="space-y-2">
            {gameHistory.map((h, i) => (
              <div key={i} className="bg-card p-4 rounded-2xl border border-white/5 flex justify-between items-center shadow-lg">
                 <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", h.winPoints > 0 ? "bg-primary/20 text-primary" : "bg-white/5 text-white/20")}><Trophy className="w-5 h-5" /></div>
                    <div>
                       <p className="text-sm font-black">{h.label}</p>
                       <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(h.createdAt), 'HH:mm:ss')}</p>
                    </div>
                 </div>
                 <span className={cn("text-lg font-black", h.winPoints > 0 ? "text-primary" : "text-white/20")}>{h.winPoints > 0 ? `+${h.winPoints}` : '0'}P</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};
