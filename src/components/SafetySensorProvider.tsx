import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ShieldAlert, AlertTriangle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface SafetySensorContextType {
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  lastAcceleration: { x: number; y: number; z: number } | null;
}

const SafetySensorContext = createContext<SafetySensorContextType | undefined>(undefined);

export const SafetySensorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastAcceleration, setLastAcceleration] = useState<{ x: number; y: number; z: number } | null>(null);
  const [alertType, setAlertType] = useState<'FALL' | 'IMPACT' | null>(null);
  const [countdown, setCountdown] = useState(15);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallStartTimeRef = useRef<number | null>(null);
  const isAlertingRef = useRef(false);

  useEffect(() => {
    // Standard siren sound
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    audioRef.current.loop = true;

    return () => {
      stopMonitoring();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const triggerAlert = (type: 'FALL' | 'IMPACT') => {
    if (isAlertingRef.current) return;
    isAlertingRef.current = true;
    setAlertType(type);
    setCountdown(15);
    
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Audio play failed", e));
    }

    // Start countdown
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          sendEmergencySOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelAlert = () => {
    isAlertingRef.current = false;
    setAlertType(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const sendEmergencySOS = async () => {
    if (!profile) return;

    try {
      // Update user status
      await updateDoc(doc(db, 'users', profile.uid), {
        isFalling: alertType === 'FALL',
        hasImpacted: alertType === 'IMPACT',
        fallDetectedAt: alertType === 'FALL' ? new Date().toISOString() : null,
        impactDetectedAt: alertType === 'IMPACT' ? new Date().toISOString() : null,
      });

      // Find admins to notify
      const { getDocs, query, where, collection } = await import('firebase/firestore');
      const adminQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['CEO', 'DIRECTOR', 'GENERAL_AFFAIRS', 'GENERAL_MANAGER', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER'])
      );
      const adminSnap = await getDocs(adminQuery);
      
      const notificationPromises = adminSnap.docs.map(adminDoc => 
        addDoc(collection(db, 'notifications'), {
          uid: adminDoc.id,
          title: `[긴급] ${alertType === 'FALL' ? '추락' : '충격'} 감지`,
          message: `${profile.displayName} (${profile.employeeId})님의 기기에서 ${alertType === 'FALL' ? '자유 낙하' : '강한 충격'}가 감지되었습니다. 무반응으로 인해 긴급 SOS가 발송되었습니다.`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        })
      );

      await Promise.all(notificationPromises);

      toast.error('긴급 SOS가 관리자에게 발송되었습니다!');
    } catch (err) {
      console.error("SOS failed", err);
    }
  };

  const startMonitoring = async () => {
    if (isMonitoring) return;

    try {
      // Request permission if needed (some browsers/platforms)
      if ((DeviceMotionEvent as any).requestPermission) {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response !== 'granted') {
          toast.error('센서 권한이 거부되었습니다.');
          return;
        }
      }

      await Motion.addListener('accel', (event) => {
        const { x, y, z } = event.accelerationIncludingGravity;
        setLastAcceleration({ x, y, z });

        // Fall detection logic
        // Total magnitude of acceleration including gravity
        // When in free fall, magnitude drops close to 0 (since gravity isn't felt by the device)
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        
        // 1. Free fall detection (< 3.0 m/s^2 for > 150ms)
        if (magnitude < 3.0) {
          if (!fallStartTimeRef.current) {
            fallStartTimeRef.current = Date.now();
          } else if (Date.now() - fallStartTimeRef.current > 150) {
            triggerAlert('FALL');
          }
        } else {
          fallStartTimeRef.current = null;
        }

        // 2. Impact detection (> 35.0 m/s^2)
        if (magnitude > 35.0) {
          triggerAlert('IMPACT');
        }
      });

      setIsMonitoring(true);
      toast.success('실시간 안전 센서 모니터링 시작');
    } catch (err) {
      console.error("Monitoring failed", err);
      toast.error('센서 모니터링을 시작할 수 없습니다.');
    }
  };

  const stopMonitoring = () => {
    Motion.removeAllListeners();
    setIsMonitoring(false);
  };

  // Automatically start monitoring if profile exists and it's a worker role
  useEffect(() => {
     if (profile && !isMonitoring) {
        startMonitoring();
     }
  }, [profile]);

  return (
    <SafetySensorContext.Provider value={{ isMonitoring, startMonitoring, stopMonitoring, lastAcceleration }}>
      {children}
      
      {/* Emergency Overlay */}
      <AnimatePresence>
        {alertType && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-600 p-6"
          >
            <div className="max-w-md w-full flex flex-col items-center text-center">
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl mb-8"
              >
                <ShieldAlert className="w-12 h-12 text-red-600" />
              </motion.div>
              
              <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">
                {alertType === 'FALL' ? '추락 감지!' : '강한 충격 감지!'}
              </h1>
              <p className="text-white/80 text-lg font-bold mb-12">
                몸 상태는 괜찮으신가요?<br />
                {countdown}초 후에 자동으로 긴급 SOS를 발송합니다.
              </p>

              <div className="w-full space-y-4">
                <Button 
                  size="lg" 
                  className="w-full h-20 rounded-[2rem] bg-white text-red-600 hover:bg-white/90 text-2xl font-black gap-3 shadow-xl"
                  onClick={cancelAlert}
                >
                  <Check className="w-8 h-8" />
                  저 괜찮아요!
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full h-16 rounded-[2rem] border-white/20 bg-red-700 text-white hover:bg-red-800 text-lg font-bold gap-3"
                  onClick={sendEmergencySOS}
                >
                  <AlertTriangle className="w-6 h-6" />
                  지금 바로 SOS 발송
                </Button>
              </div>
            </div>
            
            {/* Background flashing effects */}
            <motion.div 
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="absolute inset-0 bg-white pointer-events-none" 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </SafetySensorContext.Provider>
  );
};

export const useSafetySensor = () => {
  const context = useContext(SafetySensorContext);
  if (context === undefined) {
    throw new Error('useSafetySensor must be used within a SafetySensorProvider');
  }
  return context;
};
