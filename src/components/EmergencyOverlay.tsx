import React, { useEffect, useState } from 'react';
import { db } from '@/src/firebase';
import { doc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore';
import { EvacuationStatus } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const EmergencyOverlay: React.FC = () => {
  const { profile } = useAuth();
  const [status, setStatus] = useState<EvacuationStatus | null>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'evacuation', 'status'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as EvacuationStatus;
        setStatus(data);
        // Reset confirmation if a new evacuation event started
        // (Simplified: we can use the activatedAt timestamp as a trigger)
      } else {
        setStatus(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (status?.isActive && profile) {
      const checkinRef = doc(db, 'evacuations', status.id, 'checkins', profile.uid);
      const unsubscribeAuto = onSnapshot(checkinRef, (snap) => {
        setHasConfirmed(snap.exists());
      });
      return () => unsubscribeAuto();
    } else {
      setHasConfirmed(false);
    }
  }, [status?.isActive, status?.id, profile]);

  const handleConfirmSafety = async () => {
    if (!profile || !status?.isActive || hasConfirmed) return;

    setIsSubmitting(true);
    try {
      const checkinRef = doc(db, 'evacuations', status.id, 'checkins', profile.uid);
      await setDoc(checkinRef, {
        uid: profile.uid,
        displayName: profile.displayName,
        departmentName: profile.departmentName || '소속 없음',
        confirmedAt: new Date().toISOString()
      });

      // Increment global confirmed count
      await updateDoc(doc(db, 'evacuation', 'status'), {
        confirmedCount: increment(1)
      });

      toast.success('안전 확인이 완료되었습니다.');
    } catch (err) {
      console.error("Safety confirmation error:", err);
      toast.error('확인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!status?.isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-600 p-6 md:p-12 overflow-hidden"
      >
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-full h-full bg-[radial-gradient(circle,white_0%,transparent_70%)]"
          />
        </div>

        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-lg bg-white rounded-[40px] p-10 shadow-2xl flex flex-col items-center text-center gap-8"
        >
          <div className="w-24 h-24 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-2">
            <AlertTriangle className="w-12 h-12" />
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              비상 대피령 발동
            </h1>
            <p className="text-lg font-bold text-slate-500 leading-relaxed">
              {status.reason || '긴급 상황이 발생했습니다.'}
              <br />
              <span className="text-red-600">안전 구역으로 대피 후</span> 버튼을 눌러주세요.
            </p>
          </div>

          <div className="w-full space-y-4">
            {hasConfirmed ? (
              <div className="flex flex-col items-center gap-4 p-8 bg-green-50 rounded-[32px] border-2 border-green-200">
                <CheckCircle className="w-12 h-12 text-green-500" />
                <p className="text-xl font-black text-green-700">생존 확인 완료</p>
                <p className="text-sm font-medium text-green-600">안전 구역에서 대기해 주세요.</p>
              </div>
            ) : (
              <Button
                onClick={handleConfirmSafety}
                disabled={isSubmitting}
                className="w-full h-24 rounded-[32px] bg-red-600 hover:bg-red-700 text-white text-2xl font-black shadow-xl shadow-red-200 transition-all active:scale-95"
              >
                {isSubmitting ? '처리 중...' : '안전 확인 완료'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Shield className="w-4 h-4" />
            <p className="text-xs font-black uppercase tracking-widest">Safety Roll-Call System</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
