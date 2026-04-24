import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  addDoc, 
  getDoc,
  where
} from 'firebase/firestore';
import { LeaveRequest, UserProfile } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  CalendarDays, 
  Clock, 
  UserPlus, 
  MinusCircle, 
  PlusCircle,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export const LeaveManagement: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'EMPLOYEES'>('PENDING');

  useEffect(() => {
    const q = query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
    });

    const uQ = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(uQ, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, []);

  const handleApprove = async (request: LeaveRequest) => {
    try {
      await updateDoc(doc(db, 'leaveRequests', request.id), { status: 'APPROVED' });
      
      await addDoc(collection(db, 'notifications'), {
        uid: request.uid,
        title: '연차 승인 알림',
        message: `${request.startDate} 연차 신청이 승인되었습니다.`,
        type: 'LEAVE_RESPONSE',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success('승인 완료');
    } catch (e) {
      toast.error('오류 발생');
    }
  };

  const handleReject = async (request: LeaveRequest) => {
    try {
      await updateDoc(doc(db, 'leaveRequests', request.id), { status: 'REJECTED' });
      
      // Return balance if rejected (since we subtracted it on submission)
      const userRef = doc(db, 'users', request.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        
        let diffDays = 0;
        if (request.type === 'ANNUAL') {
          const start = new Date(request.startDate);
          const end = new Date(request.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } else {
          diffDays = 0.5;
        }

        await updateDoc(userRef, {
          annualLeaveBalance: (userData.annualLeaveBalance || 0) + diffDays
        });
      }

      await addDoc(collection(db, 'notifications'), {
        uid: request.uid,
        title: '연차 반려 알림',
        message: `${request.startDate} 연차 신청이 반려되었습니다.`,
        type: 'LEAVE_RESPONSE',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.info('반려 처리 완료 (연차 복구)');
    } catch (e) {
      toast.error('오류 발생');
    }
  };

  const adjustBalance = async (userId: string, amount: number) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentBalance = userSnap.data().annualLeaveBalance || 0;
        await updateDoc(userRef, { annualLeaveBalance: currentBalance + amount });
        toast.success(`연차가 ${amount > 0 ? '+' : ''}${amount}일 조정되었습니다.`);
      }
    } catch (e) {
      toast.error('조정 실패');
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const historyRequests = requests.filter(r => r.status !== 'PENDING').slice(0, 50);
  const filteredUsers = users.filter(u => 
    u.displayName.includes(searchTerm) || u.employeeId?.includes(searchTerm)
  ).sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">연차/휴가 통합 관리</h2>
        <p className="text-muted-foreground font-bold">사원들의 휴가 신청을 검토하고 연차를 관리하세요</p>
      </header>

      <div className="flex p-1 bg-white/5 rounded-2xl gap-1">
        {(['PENDING', 'HISTORY', 'EMPLOYEES'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 h-12 rounded-xl text-xs font-black transition-all",
              activeTab === tab ? "bg-white text-black shadow-lg" : "text-muted-foreground hover:text-white"
            )}
          >
            {tab === 'PENDING' ? `승인대기 (${pendingRequests.length})` : tab === 'HISTORY' ? '처리내역' : '연차조정'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === 'PENDING' && (
          pendingRequests.length > 0 ? (
            pendingRequests.map(req => (
              <Card key={req.id} className="bg-card border-white/5 rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">
                         {req.displayName?.charAt(0) || '사'}
                       </div>
                       <div>
                         <p className="text-sm font-black text-white">{req.displayName}</p>
                         <p className="text-[10px] text-muted-foreground font-bold">{req.employeeId || 'ID 미지정'}</p>
                       </div>
                    </div>
                    <Badge className="bg-white/5 text-muted-foreground border-none px-2 py-0.5 rounded-lg text-[10px] font-black">
                      {req.type === 'ANNUAL' ? '연차' : '반차'}
                    </Badge>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <CalendarDays className="w-4 h-4" />
                      <span className="text-sm font-black tracking-tight">
                        {req.startDate}{req.startDate !== req.endDate ? ` ~ ${req.endDate}` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-bold leading-relaxed">{req.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button 
                      variant="ghost" 
                      className="bg-white/5 hover:bg-red-500/20 text-red-500 font-black h-12 rounded-xl border border-white/5"
                      onClick={() => handleReject(req)}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> 반려
                    </Button>
                    <Button 
                      className="bg-primary text-white hover:bg-primary/90 font-black h-12 rounded-xl"
                      onClick={() => handleApprove(req)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> 승인
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="py-20 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-primary/20 mx-auto" />
              <p className="text-sm font-bold text-muted-foreground">대기 중인 신청이 없습니다.</p>
            </div>
          )
        )}

        {activeTab === 'HISTORY' && (
          <div className="space-y-3">
            {historyRequests.map(req => (
              <div key={req.id} className="bg-card p-5 rounded-2xl border border-white/5 flex items-center justify-between group">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    req.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {req.status === 'APPROVED' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white truncate">{req.displayName}</span>
                      <span className="text-[10px] text-muted-foreground font-bold">{req.startDate}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold truncate opacity-60">
                      {req.reason}
                    </p>
                  </div>
                </div>
                <Badge className={cn(
                  "border-none rounded-lg px-2 h-5 text-[9px] font-black shrink-0",
                  req.status === 'APPROVED' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                )}>
                  {req.status === 'APPROVED' ? '승인' : '반려'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'EMPLOYEES' && (
          <div className="space-y-4">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <Input 
                  placeholder="사원 검색..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-white/5 border-none h-14 pl-12 rounded-2xl text-white font-bold" 
                />
             </div>

             <div className="space-y-3">
                {filteredUsers.map(user => (
                  <Card key={user.uid} className="bg-card border-white/5 rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/5 text-muted-foreground rounded-xl flex items-center justify-center font-black">
                            {user.displayName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-white">{user.displayName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{user.employeeId || 'ID 없음'}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4">
                          <div className="text-right">
                             <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">잔여 연차</p>
                             <p className="text-lg font-black text-white">{user.annualLeaveBalance || 0}일</p>
                          </div>
                          <div className="flex gap-1">
                             <button 
                                onClick={() => adjustBalance(user.uid, -1)}
                                className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90 transition-all"
                             >
                               <MinusCircle className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => adjustBalance(user.uid, 1)}
                                className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 transition-all"
                             >
                               <PlusCircle className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
