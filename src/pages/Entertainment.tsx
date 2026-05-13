import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/firebase';
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
  const [pointsToBet, setPointsToBet] = useState(0.2); // Fixed to 0.2
  const [gameHistory, setGameHistory] = useState<any[]>([]);

  // Ship Race State
  const [selectedShip, setSelectedShip] = useState<number | null>(null);
  const [isRacing, setIsRacing] = useState(false);
  const [shipStats, setShipStats] = useState<any[]>(
    Array(5).fill(0).map(() => ({ pos: 0, status: 'normal', speed: 0, event: null }))
  );
  const [winner, setWinner] = useState<number | null>(null);
  const [shipRaceProbs, setShipRaceProbs] = useState<number[]>([1, 1, 1, 1, 1]);

  // Snail Race State
  const [selectedSnail, setSelectedSnail] = useState<number | null>(null);
  const [isSnailRacing, setIsSnailRacing] = useState(false);
  const [snailStats, setSnailStats] = useState<any[]>(
    Array(5).fill(0).map(() => ({ pos: 0, status: 'normal', speed: 0, event: null }))
  );
  const [snailWinner, setSnailWinner] = useState<number | null>(null);
  const [snailRaceProbs, setSnailRaceProbs] = useState<number[]>([1, 1, 1, 1, 1]);

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
  const [fishingPointsBet, setFishingPointsBet] = useState(0.2); // Fixed to 0.2
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
        setShipRaceProbs(data.shipRaceProbabilities || [1, 1, 1, 1, 1]);
        setSnailRaceProbs(data.snailRaceProbabilities || [1, 1, 1, 1, 1]);
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
    const FIXED_BET = 0.2;
    if (isSpinning || !profile) return;
    if (profile.points < FIXED_BET) {
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
      
      const targetRotationOffset = 360 - (selectedIdx * segmentAngle + segmentAngle / 2);
      
      const randomNoise = (Math.random() - 0.5) * (segmentAngle * 0.6); 
      const totalNewRotation = Math.ceil(rotation / 360) * 360 + (360 * 10) + targetRotationOffset + randomNoise;
      
      setRotation(totalNewRotation);

      setTimeout(async () => {
        setIsSpinning(false);
        const winPoints = parseFloat((FIXED_BET * selected.multiplier).toFixed(2));
        const pointDiff = parseFloat((winPoints - FIXED_BET).toFixed(2));

        await updateDoc(doc(db, 'users', profile.uid), {
          points: increment(pointDiff)
        });

        await addDoc(collection(db, 'lottoHistory'), {
          uid: profile.uid,
          type: 'ROULETTE',
          label: selected.label,
          betPoints: FIXED_BET,
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

  const startShipRace = async () => {
    const FIXED_BET = 0.2;
    if (isRacing || selectedShip === null || !profile) return;
    if (profile.points < FIXED_BET) {
      toast.error('포인트가 부족합니다.');
      return;
    }

    setIsRacing(true);
    setWinner(null);
    
    // Smooth race simulation (v-based)
    const initialStats = Array(5).fill(0).map((_, i) => ({ 
      pos: 0, 
      status: 'normal', 
      event: null as string | null,
      speed: 0,
      targetSpeed: 0
    }));
    setShipStats(initialStats);

    const startTime = Date.now();
    const DURATION = 15000;
    let currentStats = initialStats.map(s => ({ ...s }));
    let lastTime = startTime;

    const updateRace = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / DURATION);
      
      let isDone = false;
      let winnerIdx = -1;

      const nextStats = currentStats.map((ship, i) => {
        if (isDone || ship.pos >= 100) return ship;

        const prob = shipRaceProbs[i] || 1;
        
        // Base speed to reach 100 in 15 seconds (~6.67 units/sec)
        // Adjust by probability
        const baseSpeed = (100 / 15) * (0.9 + (prob - 1) * 0.15);
        
        let eventMultiplier = 1.0;
        let nextStatus = ship.status;
        let nextEvent = ship.event;

        // Random events logic for ships (smooth speed transitions)
        if (ship.status === 'normal' && Math.random() < 0.007) {
          const type = Math.random();
          if (type < 0.25) {
             nextStatus = 'fuel';
             nextEvent = '기름 충전! ⛽';
          } else if (type < 0.5) {
             nextStatus = 'repair';
             nextEvent = '수리 중... 🔧';
          } else if (type < 0.75) {
             nextStatus = 'booster';
             nextEvent = '부스터 온! 🚀';
          } else {
             nextStatus = 'reef';
             nextEvent = '암초 회피 중 ⚓';
          }

          setTimeout(() => {
            currentStats[i].status = 'normal';
            currentStats[i].event = null;
          }, 2000);
        }

        if (nextStatus === 'fuel') eventMultiplier = 1.4;
        else if (nextStatus === 'booster') eventMultiplier = 1.7;
        else if (nextStatus === 'repair') eventMultiplier = 0.6;
        else if (nextStatus === 'reef') eventMultiplier = 0.4;

        // Smooth speed transition
        const currentTargetSpeed = baseSpeed * eventMultiplier;
        const speedFollowFactor = 0.8; // Smooth but responsive
        ship.speed += (currentTargetSpeed - ship.speed) * Math.min(1, deltaTime * speedFollowFactor);

        // Natural jitter
        const jitter = Math.random() * 0.15;
        const delta = (ship.speed + jitter) * deltaTime;
        
        let nextPos = ship.pos + delta;

        // Extremely subtle finish push if behind
        if (progress > 0.85 && nextPos < 100) {
          nextPos += (100 - nextPos) * (0.01 * deltaTime * 60);
        }

        if (nextPos >= 100 && !isDone) {
          isDone = true;
          winnerIdx = i;
        }

        return { ...ship, pos: nextPos, status: nextStatus, event: nextEvent };
      });

      currentStats = nextStats;
      setShipStats(nextStats);

      if (elapsed < DURATION + 3000 && !isDone) {
        requestAnimationFrame(updateRace);
      } else if (isDone) {
        setTimeout(() => handleShipRaceEnd(winnerIdx), 800);
      } else {
        const leaderIdx = currentStats.reduce((prev, curr, idx) => curr.pos > currentStats[prev].pos ? idx : prev, 0);
        handleShipRaceEnd(leaderIdx);
      }
    };

    setTimeout(() => {
      lastTime = Date.now(); // Reset lastTime right before starting for smoothness
      requestAnimationFrame(updateRace);
    }, 1000);
  };

  const startSnailRace = async () => {
    const FIXED_BET = 0.2;
    if (isSnailRacing || selectedSnail === null || !profile) return;
    if (profile.points < FIXED_BET) {
      toast.error('포인트가 부족합니다.');
      return;
    }

    setIsSnailRacing(true);
    setSnailWinner(null);
    
    const initialStats = Array(5).fill(0).map((_, i) => ({ 
      pos: 0, 
      status: 'normal', 
      event: null as string | null,
      speed: 0
    }));
    setSnailStats(initialStats);

    const startTime = Date.now();
    const DURATION = 15000; // 15 seconds race
    let currentStats = initialStats.map(s => ({ ...s }));
    let lastTime = startTime;
    let isDone = false;
    let winnerIdx = -1;

    const updateRace = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const elapsed = now - startTime;
      const progress = Math.min(1.2, elapsed / DURATION); 

      const nextStats = currentStats.map((snail, i) => {
        if (isDone || snail.pos >= 100) return snail;

        const prob = snailRaceProbs[i] || 1;
        // Base speed ensure finishing in ~13-15s
        const baseSpeed = (100 / 14) * (0.95 + (prob - 1) * 0.15);

        let nextStatus = snail.status;
        let nextEvent = snail.event;
        let eventMultiplier = 1.0;

        if (snail.status === 'normal' && Math.random() < 0.015) {
           const type = Math.random();
           if (type < 0.4) {
              nextStatus = 'eating';
              nextEvent = "밥 묵자! 🥬";
           } else if (type < 0.8) {
              nextStatus = 'asleep';
              nextEvent = "쿨쿨... 💤";
           } else {
              nextStatus = 'speed';
              nextEvent = "아자아자! 🔥";
           }

           setTimeout(() => {
              if (currentStats[i]) {
                 currentStats[i].status = 'normal';
                 currentStats[i].event = null;
              }
           }, 1800);
        }

        if (nextStatus === 'eating' || nextStatus === 'asleep') {
           eventMultiplier = 0;
           snail.speed = 0;
        } else if (nextStatus === 'speed') {
           eventMultiplier = 2.4; // Slightly reduced boost for stability
        }

        const currentTargetSpeed = baseSpeed * eventMultiplier;
        const speedFollowFactor = 1.0; // Responsive start
        snail.speed += (currentTargetSpeed - snail.speed) * Math.min(1, deltaTime * speedFollowFactor);

        const jitter = Math.random() * 0.2; // Natural snail jitter
        const delta = (snail.speed + jitter) * deltaTime;
        
        let nextPos = snail.pos + delta;

        // Extremely subtle finish push
        if (progress > 0.85 && nextPos < 100 && nextStatus === 'normal') {
           nextPos += (100 - nextPos) * (0.01 * deltaTime * 60);
        }

        if (nextPos >= 100) {
          nextPos = 100;
          if (!isDone) {
            isDone = true;
            winnerIdx = i;
          }
        }

        return { ...snail, pos: nextPos, status: nextStatus, event: nextEvent };
      });

      currentStats = nextStats;
      setSnailStats(nextStats);

      if (!isDone) {
        requestAnimationFrame(updateRace);
      } else {
        setTimeout(() => {
          handleSnailRaceEnd(winnerIdx);
        }, 1000);
      }
    };

    setTimeout(() => {
      lastTime = Date.now(); // Reset lastTime right before starting for smoothness
      requestAnimationFrame(updateRace);
    }, 1000);
  };

  const handleSnailRaceEnd = async (winningSnail: number) => {
    const FIXED_BET = 0.2;
    setSnailWinner(winningSnail);
    setIsSnailRacing(false);
    
    if (!profile) return;

    const isWin = winningSnail === selectedSnail;
    const winPoints = isWin ? parseFloat((FIXED_BET * 5).toFixed(2)) : 0; 
    const pointDiff = parseFloat((winPoints - FIXED_BET).toFixed(2));
    const snailNames = ['건', '명', '안', '전', '승'];

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        points: increment(pointDiff)
      });

      await addDoc(collection(db, 'lottoHistory'), {
        uid: profile.uid,
        type: 'SNAIL_RACE',
        label: `${snailNames[winningSnail]} 승리!`,
        betPoints: FIXED_BET,
        winPoints: winPoints,
        createdAt: new Date().toISOString()
      });

      if (isWin) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        toast.success(`축하합니다! '${snailNames[winningSnail]}' 달팽이가 승리하여 ${winPoints}P를 획득했습니다!`);
      } else {
        toast.error(`'${snailNames[winningSnail]}' 달팽이가 승리했습니다. 아쉽네요!`);
      }
    } catch (error) {
      toast.error('결과 저장 중 오류가 발생했습니다.');
    }
  };

  const handleShipRaceEnd = async (winningShip: number) => {
    const FIXED_BET = 0.2;
    setWinner(winningShip);
    setIsRacing(false);
    
    if (!profile) return;

    const isWin = winningShip === selectedShip;
    const winPoints = isWin ? parseFloat((FIXED_BET * 5).toFixed(2)) : 0; 
    const pointDiff = parseFloat((winPoints - FIXED_BET).toFixed(2));

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        points: increment(pointDiff)
      });

      const shipNames = ['컨테이너선', 'LNG선', '유조선', '벌크선', '화학선'];
    await addDoc(collection(db, 'lottoHistory'), {
      uid: profile.uid,
      type: 'SHIP_RACE',
      label: `${shipNames[winningShip]} 승리!`,
      betPoints: FIXED_BET,
      winPoints: winPoints,
      createdAt: new Date().toISOString()
    });

    if (isWin) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      toast.success(`축하합니다! ${shipNames[winningShip]}이 승리하여 ${winPoints}P를 획득했습니다!`);
    } else {
      toast.error(`${shipNames[winningShip]}이 승리했습니다. 아쉽네요!`);
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
          // Early Failure Logic: 70% of fishes are pre-determined to escape within 5 seconds
          if (timeInFight < 5000 && willEscape && Math.random() < 0.12) {
            handleFishingFail('ESCAPE');
            return prev;
          }

          // Damage logic: Optimal zone 45-75
          const isOptimal = nextTension > 45 && nextTension < 75;
          const tensionFactor = isOptimal ? 4.5 : 1.2; // Increased base damage
          
          if (isOptimal) setCombo(c => Math.min(100, c + 5));
          else setCombo(c => Math.max(0, c - 8));

          const damage = (Math.random() * 3.0 + 2.0) * tensionFactor * (1 + (combo / 40));
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
    <div className="space-y-6 pb-24 px-1 text-foreground">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(3); opacity: 0; }
        }
        .ripple-effect {
          position: absolute;
          border-radius: 50%;
          background: rgba(var(--primary), 0.4);
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
        <h2 className="text-3xl font-black tracking-tight italic drop-shadow-lg uppercase text-foreground">건명 놀이터</h2>
        <p className="text-[10px] font-black text-primary tracking-[0.3em] uppercase">프리미엄 아케이드</p>
      </header>

      <div className="bg-card p-6 rounded-3xl border border-border flex flex-col items-center gap-4 text-center shadow-xl">
         <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20">
            <Coins className="w-6 h-6 text-yellow-500" />
         </div>
         <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">현재 보유 포인트</p>
            <p className="text-4xl font-black italic text-foreground leading-none">{profile?.points?.toLocaleString() || 0} <span className="text-xl text-yellow-500 not-italic">P</span></p>
         </div>
      </div>

      <div className="bg-muted p-2 rounded-3xl grid grid-cols-4 gap-1.5 border border-border shadow-2xl relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
         {[
           {id:'roulette', label:'룰렛'},
           {id:'ship', label:'진수식'},
           {id:'snail', label:'달팽이'},
           {id:'fishing', label:'낚시'}
         ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "py-3 px-1 rounded-2xl font-black text-[10px] uppercase tracking-tighter transition-all duration-300 relative z-10 whitespace-nowrap",
                activeTab === tab.id ? "text-foreground shadow-2xl scale-[1.05]" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabSlot" className="absolute inset-0 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              <span className="relative z-10 italic">{tab.label}</span>
            </button>
          ))}
       </div>

       <div className="min-h-[460px] relative">
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
                      <p className="text-[9px] font-black text-yellow-400 tracking-[0.3em] uppercase">건명 행운 포인트</p>
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
                               <span className="text-[10px] font-black text-white italic drop-shadow-md">시작!</span>
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
                      <div className="flex items-center gap-4 bg-black/40 p-4 rounded-3xl border border-white/5 w-full justify-center">
                         <div className="text-center">
                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-1">고정 배팅 금액</p>
                            <p className="text-3xl font-black text-white italic">0.2 <span className="text-sm font-bold text-rose-500 not-italic">P</span></p>
                         </div>
                      </div>
                      
                      <p className="text-[10px] font-black text-white/40 italic">돌릴 때마다 행운이 찾아옵니다! 지금 바로 시작을 누르세요.</p>
                   </div>
                </div>
             </motion.div>
           )}
 
             {activeTab === 'ship' && (
               <motion.div key="ship" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-6 pt-4">
                  <div className="relative bg-[#075985] rounded-[2.5rem] border-8 border-slate-900 shadow-2xl overflow-hidden min-h-[440px] group">
                     {/* Shipyard Background */}
                     <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />
                     <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-blue-900 via-blue-900/40 to-transparent pointer-events-none" />
                     <div className="absolute inset-0 bg-blue-500/5 backdrop-blur-[0.5px]" />
                     
                     {/* Waves animations */}
                     <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
                        <div className="water-animation opacity-30 absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/waves.png')] scale-150" />
                     </div>
 
                     {/* Header Board */}
                     <div className="relative z-20 flex justify-center pt-6 pb-2">
                        <div className="bg-slate-900 border-2 border-primary/40 px-8 py-3 rounded-2xl shadow-2xl backdrop-blur-xl">
                           <h3 className="text-xl md:text-2xl font-black text-white italic tracking-tighter drop-shadow-lg uppercase leading-none">
                              진수식 배 띄우기 레이스
                           </h3>
                           <div className="flex justify-center gap-1 mt-1">
                              {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                           </div>
                        </div>
                     </div>
 
                     <div className="relative px-4 pb-12 space-y-2.5 mt-6">
                        {/* Finish Line (Harbor Entrance) */}
                        <div className="absolute right-4 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent via-white/5 to-transparent border-x border-white/10 z-10 flex flex-col items-center justify-around">
                           {[...Array(10)].map((_, i) => <div key={i} className="w-2 h-0.5 bg-yellow-400/50" />)}
                        </div>
                        
                        {[0, 1, 2, 3, 4].map(idx => {
                          const shipNames = ['컨테이너선', 'LNG선', '유조선', '벌크선', '화학선'];
                          const shipIcons = ['🚢', '⛴️', '🛳️', '🛥️', '🚢'];
                          const shipColors = ['from-orange-500 to-rose-600', 'from-blue-500 to-cyan-600', 'from-emerald-500 to-teal-600', 'from-purple-500 to-indigo-600', 'from-amber-500 to-yellow-600'];
                          
                          return (
                            <div key={idx} className="relative h-14 flex flex-col justify-center">
                               {/* Dock Lane */}
                               <div className="absolute inset-y-1 left-0 right-4 bg-slate-900/40 border-y border-white/5 rounded-lg flex items-center px-4">
                                  <span className="text-[10px] font-black text-white/5 uppercase tracking-widest">{shipNames[idx]} 선석</span>
                               </div>
                               
                               <motion.div 
                                 animate={{ x: `${shipStats[idx]?.pos}%` }} 
                                 transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
                                 className="absolute inset-y-0 z-20 left-0 right-12 flex items-center"
                               >
                                  <div className="flex items-center gap-3">
                                     <div className="relative">
                                        <div className={cn(
                                          "w-12 h-12 rounded-2xl border-2 border-white/20 shadow-2xl flex items-center justify-center text-xl relative bg-gradient-to-br overflow-hidden",
                                          shipColors[idx],
                                          winner === idx && "ring-4 ring-yellow-400 animate-pulse scale-125 z-30",
                                          shipStats[idx]?.status !== 'normal' && "filter contrast-125"
                                        )}>
                                           <div className="absolute inset-0 bg-black/20" />
                                           <span className="relative z-10 drop-shadow-lg">{shipIcons[idx]}</span>
                                           
                                           {/* Propeller animation if normal/fuel */}
                                           {(shipStats[idx]?.status === 'normal' || shipStats[idx]?.status === 'fuel') && (
                                             <div className="absolute left-0 bottom-0 w-full h-1 bg-white/20 animate-pulse" />
                                           )}
                                        </div>
                                        
                                        {/* Name Badge */}
                                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded border border-white/10 z-20">
                                           <p className="text-[7px] font-black text-white uppercase tracking-tighter italic">{shipNames[idx]} | {Math.floor(shipStats[idx]?.pos || 0)}%</p>
                                        </div>
                                     </div>
 
                                     {/* Event Feedback */}
                                     <AnimatePresence>
                                        {shipStats[idx]?.event && (
                                          <motion.div 
                                            initial={{ opacity: 0, x: -20 }} 
                                            animate={{ opacity: 1, x: 0 }} 
                                            exit={{ opacity: 0, y: -20 }}
                                            className="bg-black/90 p-1.5 rounded-lg border border-white/10 shadow-xl"
                                          >
                                             <p className="text-[8px] font-black text-white italic whitespace-nowrap">{shipStats[idx].event}</p>
                                          </motion.div>
                                        )}
                                     </AnimatePresence>
                                  </div>
                               </motion.div>
                            </div>
                          );
                        })}
                     </div>
 
                     {!isRacing && winner === null && (
                       <div className="absolute inset-0 flex items-center justify-center z-30 px-6 backdrop-blur-[2px]">
                         <div className="bg-slate-900 border-2 border-primary/40 p-6 rounded-[2.5rem] shadow-2xl max-w-xs w-full text-center space-y-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto border border-primary/20">
                               <Anchor className="w-6 h-6 text-primary" />
                            </div>
                            <div className="space-y-1">
                               <h4 className="text-white font-black text-lg italic uppercase leading-none">진수식 레이스 대기</h4>
                               <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest leading-relaxed">
                                  격동하는 바다를 가를 선박을 선택하세요!<br/>
                                  우승 시 배팅액의 <span className="text-primary font-black text-xs">5배</span> 획득
                               </p>
                            </div>
                         </div>
                       </div>
                     )}
                  </div>
 
                  <div className="grid grid-cols-5 gap-2">
                     {[0, 1, 2, 3, 4].map(idx => {
                       const shipNames = ['컨테이너선', 'LNG선', '유조선', '벌크선', '화학선'];
                       const shipIcons = ['🚢', '⛴️', '🛳️', '🛥️', '🚢'];
                       const shipColors = ['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500'];
                       
                       return (
                         <button 
                           key={idx} 
                           onClick={() => !isRacing && setSelectedShip(idx)} 
                           className={cn(
                             "group p-3 rounded-[1.5rem] border-2 transition-all text-center flex flex-col items-center gap-2", 
                             selectedShip === idx 
                               ? "bg-white border-primary text-black shadow-xl translate-y-[-4px] scale-105" 
                               : "bg-white/5 border-white/5 text-white/40 hover:text-white hover:bg-white/10"
                           )}
                         >
                           <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110", shipColors[idx])}>{shipIcons[idx]}</div>
                           <div className="text-[8px] font-black uppercase tracking-tighter leading-tight italic">{shipNames[idx]}</div>
                         </button>
                       );
                     })}
                  </div>
 
                  <div className="space-y-4">
                     <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl flex flex-col items-center gap-1 shadow-inner relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] relative z-10">진수식 배 띄우기</span>
                        <span className="text-3xl font-black text-white italic relative z-10">0.2 <span className="text-sm font-bold text-primary not-italic">P</span></span>
                     </div>
                     
                     <Button 
                       onClick={startShipRace} 
                       disabled={isRacing || selectedShip === null} 
                       className={cn(
                         "w-full h-16 rounded-[1.8rem] font-black text-xl shadow-2xl transition-all active:scale-95 uppercase italic",
                         isRacing ? "bg-white/5 text-white/20" : "bg-gradient-to-r from-primary to-[#3182f6] text-white hover:shadow-primary/20"
                       )}
                     >
                       {isRacing ? '진수식 진행 중...' : '배팅 완료 & 배 띄우기'}
                     </Button>
                  </div>
               </motion.div>
            )}

            {activeTab === 'snail' && (
                <motion.div key="snail" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-6 pt-4">
                   <div className="relative bg-[#4a6b22] rounded-[3rem] border-[10px] border-[#3e2723] shadow-2xl overflow-hidden min-h-[580px] group">
                      {/* Nature Background */}
                      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center brightness-90 scale-110" />
                      <div className="absolute inset-0 bg-emerald-900/20 backdrop-blur-[0.5px]" />
                      
                      {/* Title Bar */}
                      <div className="relative z-20 flex justify-center pt-8 pb-4">
                         <div className="bg-gradient-to-b from-[#a1887f] to-[#8d6e63] border-4 border-yellow-400 px-8 py-3 rounded-2xl shadow-[0_8px_0_#5d4037] transform -rotate-1 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                            <div className="absolute top-0 left-0 w-full h-1 bg-white/30" />
                            <div className="flex items-center gap-2">
                               <Trophy className="w-5 h-5 text-yellow-300 drop-shadow-md" />
                               <h3 className="text-xl md:text-2xl font-black text-white italic tracking-tighter drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] uppercase leading-none font-serif whitespace-nowrap">
                                  건명 달팽이 레이싱
                               </h3>
                               <Trophy className="w-5 h-5 text-yellow-300 drop-shadow-md" />
                            </div>
                         </div>
                      </div>

                      <div className="relative px-8 pb-16 space-y-7 mt-8">
                         {/* Finish Line Flag */}
                         <div className="absolute right-4 top-0 bottom-0 w-8 flex flex-col items-center justify-around z-10 pointer-events-none opacity-80">
                            {[...Array(12)].map((_, i) => (
                               <div key={i} className="flex flex-col items-center gap-1">
                                  <div className="w-4 h-4 bg-white/10 rounded-full border-2 border-white/20 flex items-center justify-center font-black text-[8px] text-white/40">G</div>
                               </div>
                            ))}
                         </div>
                         
                         {[0, 1, 2, 3, 4].map(idx => {
                            const snailNames = ['건', '명', '안', '전', '승'];
                            const snailColors = ['#fbbf24', '#60a5fa', '#34d399', '#c084fc', '#fb7185'];
                            
                            return (
                              <div key={idx} className="relative h-14 flex flex-col justify-center">
                                {/* Track Line */}
                                <div className="absolute inset-y-1 left-0 right-4 bg-[#8d6e63] border-y-4 border-[#5d4037] rounded-full overflow-hidden shadow-inner">
                                   <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-15 brightness-200" />
                                   <div className="absolute inset-x-0 h-0.5 top-1/2 -translate-y-1/2 flex justify-between px-20">
                                      {[...Array(6)].map((_, i) => <div key={i} className="w-8 h-full bg-white/10 rounded-full" />)}
                                   </div>
                                </div>
                                
                                <motion.div 
                                  animate={{ left: `${snailStats[idx]?.pos}%` }} 
                                  transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
                                  className="absolute inset-y-0 z-20 left-0 flex items-center"
                                  style={{ transform: 'translateX(-50%)' }}
                                >
                                   <div className="flex flex-col items-center relative">
                                      {/* Event Bubble */}
                                      <AnimatePresence>
                                         {snailStats[idx]?.event && (
                                            <motion.div 
                                              initial={{ opacity: 0, scale: 0.5 }}
                                              animate={{ opacity: 1, y: -45, scale: 1 }}
                                              exit={{ opacity: 0, scale: 0.8 }}
                                              className="absolute top-0 flex justify-center z-30"
                                            >
                                               <div className="bg-white/95 text-black text-[10px] font-black px-3 py-1.5 rounded-full shadow-2xl border-2 border-primary/30 whitespace-nowrap animate-bounce flex items-center gap-1">
                                                  <span>{snailStats[idx].event}</span>
                                               </div>
                                            </motion.div>
                                         )}
                                      </AnimatePresence>
                                      
                                      <div className="relative group flex flex-col items-center">
                                         {/* Name Tag */}
                                         <motion.div 
                                           animate={isSnailRacing ? { y: [0, -2, 0] } : {}}
                                           transition={{ repeat: Infinity, duration: 0.5 }}
                                           className="px-2 py-0.5 rounded-full border-[2px] border-white flex items-center justify-center text-[9px] font-black shadow-lg relative z-20 mb-[-4px]"
                                           style={{ backgroundColor: snailColors[idx] }}
                                         >
                                            <span className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] italic z-10">{snailNames[idx]}</span>
                                         </motion.div>
 
                                         {/* Snail Body (Icon) - Facing Forward (Right) */}
                                         <div className="text-5xl filter drop-shadow-md z-10 translate-y-1 scale-x-[-1] relative">
                                            <span className={cn(isSnailRacing && "inline-block animate-bounce")}>🐌</span>
                                            
                                            {/* Percentage Display */}
                                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 scale-x-[-1] whitespace-nowrap bg-black/70 px-2 py-0.5 rounded-full border border-white/20 shadow-xl">
                                               <p className="text-[10px] font-black text-yellow-400 italic font-mono">{Math.floor(snailStats[idx]?.pos || 0)}%</p>
                                            </div>
                                         </div>
                                      </div>
                                   </div>
                                </motion.div>
                              </div>
                            );
                         })}
                      </div>

                      {!isSnailRacing && snailWinner === null && (
                        <div className="absolute inset-0 flex items-center justify-center z-30 px-6 backdrop-blur-[2px]">
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-[#fff9e6] border-[6px] border-[#fde68a] p-10 rounded-[3rem] shadow-2xl max-w-sm w-full text-center space-y-6 relative overflow-hidden"
                          >
                             <div className="absolute top-0 inset-x-0 h-2 bg-yellow-400/20" />
                             
                             <h4 className="text-[#3c2a1a] font-black text-3xl italic uppercase drop-shadow-sm whitespace-nowrap">레이싱 진행정보</h4>
                             <div className="h-0.5 w-full bg-[#3c2a1a]/10" />
                             
                             <p className="text-[#3c2a1a] text-sm font-bold leading-relaxed px-2">
                                원하시는 달팽이를 선택하고 배팅 버튼을 눌러주세요!<br/>
                                <span className="text-rose-600 font-extrabold">1등 도착 시 배팅액의 5배</span>를 획득합니다.
                             </p>

                             <div className="flex justify-center gap-1 animate-bounce">
                                {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-yellow-500" />)}
                             </div>
                          </motion.div>
                        </div>
                      )}
                      
                      <AnimatePresence>
                         {snailWinner !== null && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9 }} 
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                            >
                               <div className="bg-[#5d4037] border-4 border-yellow-500 p-8 rounded-[3rem] text-center shadow-2xl max-w-xs w-full">
                                  <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 drop-shadow-lg" />
                                  <h4 className="text-3xl font-black text-white italic mb-2">승리!</h4>
                                  <div 
                                    className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl font-black text-white border-4 border-white mb-4 shadow-xl"
                                    style={{ backgroundColor: ['#fbbf24', '#60a5fa', '#34d399', '#c084fc', '#fb7185'][snailWinner] }}
                                  >
                                     {['건', '명', '안', '전', '승'][snailWinner]}
                                  </div>
                                  <Button 
                                    onClick={() => setSnailWinner(null)}
                                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-[#3e2723] font-black h-12 rounded-xl text-lg shadow-[0_4px_0_#b8860b]"
                                  >
                                     확인
                                  </Button>
                               </div>
                            </motion.div>
                         )}
                      </AnimatePresence>
                   </div>

                   <div className="grid grid-cols-5 gap-3">
                      {[0, 1, 2, 3, 4].map(idx => {
                         const snailNames = ['건', '명', '안', '전', '승'];
                         const snailColors = ['bg-[#fbbf24]', 'bg-[#60a5fa]', 'bg-[#34d399]', 'bg-[#c084fc]', 'bg-[#fb7185]'];
                         
                         return (
                          <button 
                            key={idx} 
                            onClick={() => !isSnailRacing && setSelectedSnail(idx)} 
                            className={cn(
                              "group p-3 rounded-[1.8rem] border-[4px] transition-all text-center flex flex-col items-center justify-center", 
                              selectedSnail === idx 
                                ? "bg-primary border-yellow-500 text-primary-foreground shadow-xl translate-y-[-6px] scale-105" 
                                : "bg-muted border-border text-muted-foreground hover:bg-card"
                            )}
                          >
                            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white transition-transform group-hover:rotate-12 shadow-lg", snailColors[idx])}>{snailNames[idx]}</div>
                          </button>
                         );
                      })}
                   </div>

                   <div className="space-y-4">
                      <div className="bg-[#3e2723]/60 border-2 border-white/10 p-6 rounded-[2.5rem] flex flex-col items-center gap-1 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                         <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
                         <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] relative z-10">건명 달팽이 레이스</span>
                         <span className="text-4xl font-black text-white italic relative z-10">0.2 <span className="text-sm font-bold text-yellow-500 not-italic">P</span></span>
                      </div>
                      
                      <Button 
                        onClick={startSnailRace} 
                        disabled={isSnailRacing || selectedSnail === null} 
                        className={cn(
                          "w-full h-20 rounded-[2.5rem] font-black text-2xl shadow-2xl transition-all active:scale-95 uppercase italic",
                          isSnailRacing ? "bg-white/5 text-white/20" : "bg-gradient-to-r from-yellow-600 to-yellow-500 text-white hover:from-yellow-500 hover:to-yellow-400 hover:shadow-yellow-500/20"
                        )}
                      >
                        {isSnailRacing ? '레이스 중...' : '배팅 완료 & 시작'}
                      </Button>
                      <p className="text-[11px] text-center font-black text-white/30 uppercase tracking-[0.2em] italic">※ 결과는 0.01초의 오차 없이 공정하게 계산됩니다.</p>
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
                                 <span className="text-[9px] font-black text-white/50 tracking-tighter italic">릴 텐션</span>
                                 <span className={cn("text-[9px] font-black italic tracking-tighter", lineTension > 70 ? "text-red-400 animate-pulse" : "text-emerald-400")}>
                                    {lineTension > 70 ? "줄 끊어짐 위험!" : lineTension > 50 ? "좋아요! 유지하세요" : "조금 더 당기세요"}
                                 </span>
                              </div>
                          </div>
                       </motion.div>
                    )}
                 </AnimatePresence>

                  {/* UI: Fish HP (Top Center - Repositioned to avoid overlap) */}
                  <AnimatePresence>
                     {fishingStatus === 'fight' && (
                        <motion.div 
                          initial={{ y: -100, opacity: 0 }}
                          animate={{ y: 80, opacity: 1 }}
                          className="absolute top-0 left-1/2 -translate-x-1/2 z-40 pointer-events-none w-48"
                        >
                           <div className="bg-black/95 backdrop-blur-xl rounded-2xl p-3 border border-white/20 shadow-2xl">
                              <div className="flex items-center justify-between mb-2">
                                 <div className="flex items-center gap-2">
                                    <div className="text-2xl animate-bounce">
                                       {targetFish?.icon || '🐟'}
                                    </div>
                                    <span className="text-[10px] font-black text-white italic tracking-tight truncate uppercase">{targetFish?.name || '목표'}</span>
                                 </div>
                                 <span className="text-[10px] font-black text-white/60 italic">{Math.ceil(fishHealth)}%</span>
                              </div>
                              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                 <motion.div 
                                   className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-red-400" 
                                   style={{ width: `${fishHealth}%` }} 
                                 />
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
                  {/* Bet Information (Fixed at 0.2P) */}
                  {!isFishing && (
                     <div className="bg-slate-900/40 p-4 rounded-3xl border border-white/5 flex flex-col items-center gap-1 shadow-inner relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] relative z-10">고정 배팅 금액</span>
                        <span className="text-3xl font-black text-white italic relative z-10">0.2 <span className="text-sm font-bold text-emerald-500 not-italic">P</span></span>
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
                  <div key={i} className="bg-card p-4 rounded-2xl border border-border flex justify-between items-center shadow-lg">
                     <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", h.winPoints > 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground/30")}><Trophy className="w-5 h-5" /></div>
                        <div>
                           <p className="text-sm font-black text-foreground">{h.label}</p>
                           <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(h.createdAt), 'HH:mm:ss')}</p>
                        </div>
                     </div>
                     <span className={cn("text-lg font-black", h.winPoints > 0 ? "text-primary" : "text-muted-foreground/30")}>{h.winPoints > 0 ? `+${h.winPoints}` : '0'}P</span>
                  </div>
                ))}
             </div>
          </div>
    </div>
  );
};
