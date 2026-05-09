import React, { useEffect, useState } from 'react';
import { db } from '@/src/firebase';
import { doc, onSnapshot, setDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { EvacuationStatus, UserProfile } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Shield, Phone, X, Search, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const EmergencyOverlay: React.FC = () => {
  const { profile, user } = useAuth();
  const [status, setStatus] = useState<EvacuationStatus | null>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // New state for missing person lists
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [checkinUids, setCheckinUids] = useState<Set<string>>(new Set());
  const [clockedInUids, setClockedInUids] = useState<Set<string>>(new Set());
  const [viewingMissingList, setViewingMissingList] = useState<'clockedIn' | 'total' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'evacuation', 'status'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as EvacuationStatus;
        setStatus(data);
      } else {
        setStatus(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to all users
  useEffect(() => {
    if (!status?.isActive) return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => doc.data() as UserProfile));
    });
    return () => unsubscribe();
  }, [status?.isActive]);

  // Listen to all check-ins for the current evacuation
  useEffect(() => {
    if (!status?.isActive || !status.id) return;
    const unsubscribe = onSnapshot(collection(db, 'evacuations', status.id, 'checkins'), (snap) => {
      setCheckinUids(new Set(snap.docs.map(doc => doc.id)));
    });
    return () => unsubscribe();
  }, [status?.isActive, status?.id]);

  // Listen to today's attendance to see who is clocked in
  useEffect(() => {
    if (!status?.isActive) return;
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'attendance'), where('date', '==', today));
    const unsubscribe = onSnapshot(q, (snap) => {
      const uids = new Set<string>();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.clockOut) {
          uids.add(data.uid);
        }
      });
      setClockedInUids(uids);
    });
    return () => unsubscribe();
  }, [status?.isActive]);

  useEffect(() => {
    if (status?.isActive && profile) {
      const checkinRef = doc(db, 'evacuations', status.id, 'checkins', profile.uid);
      const unsubscribeAuto = onSnapshot(checkinRef, (snap) => {
        setHasConfirmed(snap.exists());
        if (snap.exists()) {
          setShowStats(true); // Automatically show stats once confirmed
        }
      });
      return () => unsubscribeAuto();
    } else {
      setHasConfirmed(false);
      setShowStats(false);
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

  const handleEndSituation = async () => {
    if (!status?.id) {
      toast.error('상황 정보를 찾을 수 없습니다.');
      return;
    }
    
    if (isSubmitting) return;

    // Use toast for feedback instead of window.confirm which might be blocked
    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const endedBy = profile?.displayName || user?.displayName || user?.email || 'Administrator';
      
      console.log("Ending situation with ID:", status.id, "Ended by:", endedBy);

      // 1. Update historical record first
      try {
        await setDoc(doc(db, 'evacuations', status.id), {
          isActive: false,
          status: 'FINISHED',
          endedAt: now,
          endedBy: endedBy,
          finishedAt: now,
        }, { merge: true });
      } catch (histError) {
        console.warn("Could not update historical record, but continuing to end situation:", histError);
      }

      // 2. Update the main status flag (this triggers real-time UI close)
      // Switch from updateDoc to setDoc for maximum reliability
      await setDoc(doc(db, 'evacuation', 'status'), {
        isActive: false,
        endedAt: now,
        endedBy: endedBy
      }, { merge: true });

      toast.success('비상 상황이 종료되었습니다.');
      setShowStats(false);
      setViewingMissingList(null);
    } catch (error) {
      console.error("End situation error:", error);
      // More descriptive error for the user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`상황 종료 실패: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAuthorizedToEnd = profile?.role === 'CEO' || 
                            profile?.permissions?.includes('admin') ||
                            profile?.displayName?.includes('Moon moon') || 
                            profile?.displayName?.includes('강형규') || 
                            user?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';

  const missingList = allUsers.filter(user => {
    const isConfirmed = checkinUids.has(user.uid);
    if (isConfirmed) return false;

    if (viewingMissingList === 'clockedIn') {
      return clockedInUids.has(user.uid);
    }
    return true;
  }).filter(user => 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phoneNumber?.includes(searchTerm)
  );

  if (!status?.isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-start md:items-center justify-center bg-red-600 p-4 md:p-12 overflow-y-auto"
      >
        <div className="fixed inset-0 overflow-hidden opacity-10 pointer-events-none">
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
          className="relative z-10 w-full max-w-lg bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 shadow-2xl flex flex-col items-center text-center gap-4 max-h-[90vh] overflow-y-auto"
        >
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-0 shrink-0">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              비상 대피령 발동
            </h1>
            <p className="text-base md:text-lg font-bold text-slate-500 leading-relaxed px-2">
              {status.reason || '긴급 상황이 발생했습니다.'}
              <br />
              <span className="text-red-600">안전 구역으로 대피 후</span> 버튼을 눌러주세요.
            </p>
          </div>

          <div className="w-full space-y-4">
            {hasConfirmed ? (
              <div className="space-y-4 animate-in fade-in zoom-in duration-500">
                {showStats ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => setViewingMissingList('clockedIn')}
                        className="p-5 bg-blue-50 rounded-[28px] border-2 border-blue-100 flex flex-col items-center gap-1 transition-all hover:bg-blue-100 active:scale-95 group text-center"
                      >
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest group-hover:scale-105 transition-transform">출근 인원 생존율</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-blue-600">{status.confirmedCount || 0}</span>
                          <span className="text-lg font-bold text-blue-300">/ {status.totalClockedIn || clockedInUids.size || '-'}</span>
                        </div>
                        <div className="w-full h-2.5 bg-blue-100 rounded-full mt-1 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${((status.confirmedCount || 0) / (status.totalClockedIn || clockedInUids.size || 1)) * 100}%` }}
                            className="h-full bg-blue-500"
                          />
                        </div>
                        <p className="text-[9px] font-black text-blue-400 mt-1 uppercase tracking-widest flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          미확인 인원 확인 <Search className="w-2.5 h-2.5" />
                        </p>
                      </button>

                      <button 
                        onClick={() => setViewingMissingList('total')}
                        className="p-5 bg-emerald-50 rounded-[28px] border-2 border-emerald-100 flex flex-col items-center gap-1 transition-all hover:bg-emerald-100 active:scale-95 group text-center"
                      >
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest group-hover:scale-105 transition-transform">전체 인원 생존율</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-emerald-600">{status.confirmedCount || 0}</span>
                          <span className="text-lg font-bold text-emerald-300">/ {status.totalWorkers || allUsers.length || '-'}</span>
                        </div>
                        <div className="w-full h-2.5 bg-emerald-100 rounded-full mt-1 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${((status.confirmedCount || 0) / (status.totalWorkers || allUsers.length || 1)) * 100}%` }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                        <p className="text-[9px] font-black text-emerald-400 mt-1 uppercase tracking-widest flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          미확인 인원 확인 <Search className="w-2.5 h-2.5" />
                        </p>
                      </button>
                    </div>

                    <Button
                      onClick={() => setShowStats(false)}
                      variant="outline"
                      className="w-full h-14 rounded-2xl border-slate-200 text-slate-500 font-bold text-sm"
                    >
                      상태 확인 화면으로 돌아가기
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => setShowStats(true)}
                    className="flex flex-col items-center gap-3 p-8 bg-green-50 rounded-[32px] border-2 border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle className="w-12 h-12 text-green-500" />
                    <div className="text-center">
                      <p className="text-xl font-black text-green-700">생존 확인 완료</p>
                      <p className="text-xs font-medium text-green-600 mt-1">실시간 현황을 보려면 터치하세요</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                onClick={handleConfirmSafety}
                disabled={isSubmitting}
                className="w-full h-20 rounded-[28px] bg-red-600 hover:bg-red-700 text-white text-xl font-black shadow-xl shadow-red-200 transition-all active:scale-95"
              >
                {isSubmitting ? '처리 중...' : '안전 확인 완료'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-400 py-1">
            <Shield className="w-3.5 h-3.5" />
            <p className="text-[10px] font-black uppercase tracking-widest">Safety Roll-Call System</p>
          </div>

          {isAuthorizedToEnd && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full pt-4 border-t border-slate-100 mt-auto"
            >
              <Button
                onClick={handleEndSituation}
                disabled={isSubmitting}
                className="w-full h-12 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-2xl gap-2 shadow-xl disabled:opacity-50"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {isSubmitting ? '종료 처리 중...' : '비상 상황 종료 (강제 해제)'}
              </Button>
              <p className="text-[10px] font-bold text-slate-400 mt-2">
                * 관리자(Moon moon, 강형규) 전용 공개 버튼입니다.
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Missing Person List Overlay */}
        <AnimatePresence>
          {viewingMissingList && (
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              className="absolute inset-0 z-[10000] bg-white flex flex-col"
            >
              <div className="px-6 pt-12 pb-6 flex items-center justify-between border-b border-slate-100">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {viewingMissingList === 'clockedIn' ? '출근자 미확인 명단' : '전체 미확인 명단'}
                  </h2>
                  <p className="text-sm font-bold text-red-500">생존 확인이 되지 않은 {missingList.length}명</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setViewingMissingList(null);
                    setSearchTerm('');
                  }}
                  className="rounded-full w-12 h-12 bg-slate-50"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <div className="px-6 py-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="이름 또는 전화번호 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-20">
                {missingList.length > 0 ? (
                  <div className="space-y-3">
                    {missingList.map(user => (
                      <div key={user.uid} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-black text-slate-400">
                            {user.displayName?.[0] || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{user.displayName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {user.position} | {user.departmentName}
                            </p>
                          </div>
                        </div>
                        {user.phoneNumber ? (
                          <a 
                            href={`tel:${user.phoneNumber}`}
                            className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200 active:scale-90 transition-all"
                          >
                            < Phone className="w-5 h-5 fill-current" />
                          </a>
                        ) : (
                          <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                            No Phone
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                      <UserMinus className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-400">미확인 인원이 없습니다.</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-red-600">
                <Button 
                  onClick={() => setViewingMissingList(null)}
                  className="w-full h-14 bg-white text-red-600 hover:bg-white/90 text-lg font-black rounded-2xl"
                >
                  닫기
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
