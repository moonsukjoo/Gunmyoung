import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  addDoc, 
  getDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { LeaveRequest, UserProfile } from '@/types';
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
  Search,
  Download,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

import { GlowLoading } from '@/components/GlowLoading';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';

export const LeaveManagement: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'EMPLOYEES'>('PENDING');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));
    const q = query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      await minLoadTime;
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaveRequests');
      setLoading(false);
    });

    const uQ = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(uQ, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

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

      // Final Report to Clerk, GM, and GA
      const finalsQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['CLERK', 'GENERAL_MANAGER', 'GENERAL_AFFAIRS'])
      );
      const finalsSnapshot = await getDocs(finalsQuery);
      for (const fDoc of finalsSnapshot.docs) {
        if (fDoc.id === profile.uid) continue;
        await addDoc(collection(db, 'notifications'), {
          uid: fDoc.id,
          title: '📋 연차 승인 최종 보고',
          message: `${request.displayName}님의 연차(${request.startDate})가 최종 승인되었습니다.`,
          type: 'SYSTEM',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        });
      }

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
    (u.displayName || '').includes(searchTerm) || u.employeeId?.includes(searchTerm)
  ).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  const handleExportExcel = () => {
    if (requests.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const data = requests.map(req => ({
      '신청일': format(new Date(req.createdAt), 'yyyy-MM-dd'),
      '사원명': req.displayName,
      '사번': req.employeeId,
      '구분': req.type === 'ANNUAL' ? '연차' : '반차',
      '기간': `${req.startDate} ~ ${req.endDate}`,
      '사유': req.reason,
      '상태': req.status === 'APPROVED' ? '승인' : req.status === 'REJECTED' ? '반려' : '대기'
    }));
    exportToExcel(data, `연차신청내역_${format(new Date(), 'yyyyMMdd')}`, '연차휴가기록');
  };

  const handleExportPDF = async () => {
    if (requests.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }
    const headers = ['사원명', '구분', '시작일', '종료일', '상태'];
    const data = requests.map(req => [
      req.displayName,
      req.type === 'ANNUAL' ? '연차' : '반차',
      req.startDate,
      req.endDate,
      req.status === 'APPROVED' ? '승인' : req.status === 'REJECTED' ? '반려' : '대기'
    ]);
    await exportToPDF('연차/휴가 신청 통합 보고서', headers, data, `연차보고서_${format(new Date(), 'yyyyMMdd')}`);
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground leading-tight">연차/휴가 통합 관리</h2>
          <p className="text-xs font-bold text-muted-foreground">사원들의 휴가 신청을 검토하고 연차를 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportExcel}
            className="h-10 rounded-xl bg-muted border-border text-foreground font-black text-[10px] gap-2 hover:bg-muted/80"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" /> EXCEL
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportPDF}
            className="h-10 rounded-xl bg-muted border-border text-foreground font-black text-[10px] gap-2 hover:bg-muted/80"
          >
            <FileText className="w-3.5 h-3.5 text-rose-500" /> PDF
          </Button>
        </div>
      </header>

      <div className="flex p-1 bg-muted/50 rounded-2xl gap-1">
        {(['PENDING', 'HISTORY', 'EMPLOYEES'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 h-12 rounded-xl text-xs font-black transition-all",
              activeTab === tab ? "bg-card text-foreground shadow-lg" : "text-muted-foreground/60 hover:text-muted-foreground/90"
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
              <Card key={req.id} className="bg-card border-border rounded-2xl overflow-hidden border shadow-none">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">
                         {req.displayName?.charAt(0) || '사'}
                       </div>
                       <div>
                         <p className="text-sm font-black text-foreground">{req.displayName}</p>
                         <p className="text-[10px] text-muted-foreground font-bold">{req.employeeId || 'ID 미지정'}</p>
                       </div>
                    </div>
                    <Badge className="bg-muted text-muted-foreground border-none px-2 py-0.5 rounded-lg text-[10px] font-black shadow-none">
                      {req.type === 'ANNUAL' ? '연차' : '반차'}
                    </Badge>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-xl space-y-2 border border-border/50">
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
                      className="bg-muted hover:bg-destructive/10 text-destructive font-black h-12 rounded-xl border border-border shadow-none"
                      onClick={() => handleReject(req)}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> 반려
                    </Button>
                    <Button 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-black h-12 rounded-xl shadow-lg shadow-primary/20"
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
              <div key={req.id} className="bg-card p-5 rounded-2xl border border-border flex items-center justify-between group shadow-none">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    req.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {req.status === 'APPROVED' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-foreground truncate">{req.displayName}</span>
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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                <Input 
                  placeholder="사원 검색..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-muted border-border h-14 pl-12 rounded-2xl text-foreground font-bold border" 
                />
             </div>

             <div className="space-y-3">
                {filteredUsers.map(user => (
                  <Card key={user.uid} className="bg-card border-border rounded-2xl overflow-hidden border shadow-none">
                    <CardContent className="p-5 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted text-muted-foreground rounded-xl flex items-center justify-center font-black">
                            {user.displayName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">{user.displayName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{user.employeeId || 'ID 없음'}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4">
                          <div className="text-right">
                             <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">잔여 연차</p>
                             <p className="text-lg font-black text-foreground">{user.annualLeaveBalance || 0}일</p>
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
