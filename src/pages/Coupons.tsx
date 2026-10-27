import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { UserProfile, PraiseCoupon } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { Gift, Trophy, Settings, MapPin, Search, ShieldCheck, Download, History, Check, ChevronsUpDown, User, ChevronRight, XCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { exportToExcel, exportToPDF, exportPhotoCardPDF, ReportCardItem } from '@/lib/exportUtils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface RouletteSetting {
  id: string;
  label: string;
  multiplier: number;
  probability: number;
  color: string;
}

const DEFAULT_ROULETTE_SETTINGS: RouletteSetting[] = [
  { id: '1', label: '꽝', multiplier: 0, probability: 0.4, color: '#94a3b8' },
  { id: '2', label: '1배', multiplier: 1, probability: 0.3, color: '#3b82f6' },
  { id: '3', label: '2배', multiplier: 2, probability: 0.2, color: '#10b981' },
  { id: '4', label: '5배', multiplier: 5, probability: 0.08, color: '#f59e0b' },
  { id: '5', label: '10배', multiplier: 10, probability: 0.02, color: '#ef4444' },
];

export const Coupons: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rouletteSettings, setRouletteSettings] = useState<RouletteSetting[]>(DEFAULT_ROULETTE_SETTINGS);
  const [isAuthorizedToGive, setIsAuthorizedToGive] = useState(false);
  const [couponHistory, setCouponHistory] = useState<PraiseCoupon[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'give' | 'history' | 'settings'>('give');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  
  const [giveCouponForm, setGiveCouponForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    location: '',
    reason: '',
    points: 1,
    photoUrl: ''
  });

  const filteredCouponHistory = React.useMemo(() => {
    return couponHistory.filter(c => c.date.startsWith(selectedMonth));
  }, [couponHistory, selectedMonth]);

  useEffect(() => {
    if (!profile) return;
    
    const isAuth = profile.role === 'CEO' || 
                   profile.role === 'SAFETY_MANAGER' || 
                   profile.permissions?.includes('praise_coupon') ||
                   profile.email === 'tjrwnfjqm1@gmail.com';
    setIsAuthorizedToGive(isAuth);
    
    const unsubscribeUsers = onSnapshot(
      collection(db, 'users'), 
      (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      },
      (error) => {
        console.error("Users list sync error:", error);
        toast.error("사원 정보를 불러올 수 없습니다. 연결 상태를 확인해주세요.");
      }
    );

    const unsubscribeHistory = onSnapshot(
      collection(db, 'praiseCoupons'), 
      (snapshot) => {
        const history = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PraiseCoupon));
        setCouponHistory(history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setHistoryLoading(false);
      },
      (error) => {
        console.error("Coupon history sync error:", error);
        toast.error("지급 내역을 불러올 수 없습니다.");
        setHistoryLoading(false);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeHistory();
    };
  }, [profile]);

  const exportCouponsToExcel = () => {
    try {
      const exportData = filteredCouponHistory.map(c => {
        const receiver = users.find(u => u.uid === c.receiverUid);
        return {
          '날짜': c.date,
          '시간': c.time,
          '받는사람 이름': c.receiverName,
          '받는사람 사번': receiver?.employeeId || '-',
          '받는사람 부서': receiver?.departmentName || '-',
          '보낸사람 이름': c.senderName,
          '칭찬 포인트': `${c.points}P`,
          '장소': c.location,
          '사유': c.reason,
          '등록일시': c.createdAt
        };
      });

      exportToExcel(exportData, `칭찬쿠폰지급내역_${selectedMonth}`, "칭찬쿠폰 내역");
      toast.success('칭찬쿠폰 내역 엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error('엑셀 변환 중 오류가 발생했습니다.');
    }
  };

  const exportCouponsToPDF = async () => {
    try {
      toast.loading(`${selectedMonth} 칭찬쿠폰 4건/페이지 PDF 리포트를 생성 중입니다...`, { id: 'coupon-pdf' });
      const items: ReportCardItem[] = filteredCouponHistory.map((c, idx) => {
        const receiver = users.find(u => u.uid === c.receiverUid);
        return {
          id: c.id,
          itemNumber: idx + 1,
          date: `${c.date} ${c.time}`,
          targetName: c.receiverName,
          targetSub: `${receiver?.departmentName || '부서미지정'} / ${receiver?.employeeId || receiver?.position || '사원'}`,
          categoryBadge: '칭찬쿠폰',
          categoryType: 'reward',
          scoreBadge: `+${c.points}P`,
          scoreBadgeType: 'positive',
          authorName: `지급자: ${c.senderName}`,
          location: c.location,
          reason: c.reason,
          photoUrl: c.photoUrl || undefined
        };
      });

      await exportPhotoCardPDF({
        title: `칭찬쿠폰 지급 및 현장내역 리포트 (${selectedMonth})`,
        subtitle: `총 ${items.length}건 등록 (1페이지 4건 표준 양식, 총 ${Math.ceil(items.length / 4) || 1}페이지)`,
        monthStr: selectedMonth,
        items,
        fileName: `칭찬쿠폰_지급내역_${selectedMonth}`,
        onProgress: (cur, tot) => {
          toast.loading(`${selectedMonth} 칭찬쿠폰 PDF 리포트 생성 중... (${cur}/${tot} 쪽)`, { id: 'coupon-pdf' });
        }
      });
      toast.success(`${selectedMonth} 칭찬쿠폰 PDF 리포트(1페이지 4건)가 준비되었습니다.`, { id: 'coupon-pdf' });
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error('PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', { id: 'coupon-pdf' });
    }
  };

  const handleGiveCoupon = async () => {
    if (!isAuthorizedToGive) {
      toast.error('지급 권한이 없습니다.');
      return;
    }
    if (!selectedUser) {
      toast.error('사원을 선택해주세요.');
      return;
    }
    if (!giveCouponForm.location || !giveCouponForm.reason) {
      toast.error('장소와 사유를 입력해주세요.');
      return;
    }

    try {
      const couponData: PraiseCoupon = {
        id: Math.random().toString(36).substring(2, 9),
        senderUid: profile!.uid,
        senderName: profile!.displayName,
        senderRole: profile!.role,
        receiverUid: selectedUser,
        receiverName: users.find(u => u.uid === selectedUser)?.displayName || '알 수 없음',
        date: giveCouponForm.date,
        time: giveCouponForm.time,
        location: giveCouponForm.location,
        reason: giveCouponForm.reason,
        points: giveCouponForm.points,
        createdAt: new Date().toISOString(),
        photoUrl: giveCouponForm.photoUrl || undefined
      };

      await addDoc(collection(db, 'praiseCoupons'), couponData);
      await updateDoc(doc(db, 'users', selectedUser), { points: increment(giveCouponForm.points) });

      await addDoc(collection(db, 'notifications'), {
        uid: selectedUser,
        title: '칭찬쿠폰이 도착했습니다!',
        message: `${profile?.displayName}님께서 "${giveCouponForm.reason}" 사유로 ${giveCouponForm.points}P를 선물하셨습니다.`,
        type: 'COUPON',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success('쿠폰이 성공적으로 지급되었습니다.');
      setSelectedUser('');
      setGiveCouponForm({ ...giveCouponForm, location: '', reason: '', photoUrl: '' });
    } catch (error: any) {
      console.error("Coupon give error:", error);
      toast.error(`지급 중 오류가 발생했습니다: ${error?.message || error}`);
    }
  };

  const updateProbability = (id: string, val: string) => {
    const prob = parseFloat(val);
    if (isNaN(prob)) return;
    setRouletteSettings(prev => prev.map(s => s.id === id ? { ...s, probability: prob } : s));
  };

  if (!isAuthorizedToGive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 px-6 text-center">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/20" />
        </div>
        <h2 className="text-xl font-black text-foreground tracking-tight">접근 권한이 없습니다.</h2>
        <p className="text-sm text-muted-foreground font-medium">이 페이지는 관리자 전용 공간입니다.</p>
      </div>
    );
  }

  const totalProb = rouletteSettings.reduce((a, s) => a + s.probability, 0);
  const isProbValid = Math.abs(totalProb - 1) < 0.001;

  return (
    <div className="w-full min-h-screen py-4 px-4 pb-24 flex flex-col items-center">
      {/* Page Header - Centered Block */}
      <div className="w-full max-w-md mb-8 text-center flex flex-col items-center">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-3 bg-card px-6 py-2.5 rounded-full shadow-lg border border-border ring-4 ring-primary/5 mb-2"
        >
          <Trophy className="w-5 h-4 text-yellow-500 fill-yellow-500" />
          <h2 className="text-xl font-black tracking-tight text-foreground">칭찬쿠폰 & 룰렛 관리</h2>
        </motion.div>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.4em] leading-none">Administrative Controls</p>
      </div>

      {/* Navigation Tab Bar - Separated Layout */}
      <div className="w-full max-w-md bg-muted/50 backdrop-blur-sm p-1 rounded-2xl flex gap-1 mb-8 shadow-inner border border-border">
        <button 
          onClick={() => setActiveTab('give')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all",
            activeTab === 'give' ? "bg-card text-emerald-600 shadow-md scale-[1.02] border border-border/50" : "text-muted-foreground hover:text-foreground"
          )}
        >
          지급
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all",
            activeTab === 'history' ? "bg-card text-primary shadow-md scale-[1.02] border border-border/50" : "text-muted-foreground hover:text-foreground"
          )}
        >
          내역
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all",
            activeTab === 'settings' ? "bg-card text-foreground shadow-md scale-[1.02] border border-border/50" : "text-muted-foreground hover:text-foreground"
          )}
        >
          설정
        </button>
      </div>

      {/* Main Content Area - Separated Layout and Absolute Centering */}
      <div className="w-full max-w-md">
        {activeTab === 'give' && (
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-5 bg-emerald-500 rounded-full" />
              <h3 className="text-base font-black text-foreground uppercase tracking-widest">칭찬쿠폰 발급</h3>
            </div>

            <Card className="border-none shadow-2xl bg-card rounded-[2.5rem] overflow-hidden border border-border">
              <CardHeader className="p-8 pb-4 text-center border-b border-border">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8 text-emerald-500" />
                </div>
                <CardTitle className="text-xl font-black text-emerald-500">칭찬쿠폰 지급하기</CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-10 space-y-8">
                <div className="space-y-6">
                  {/* Integrated Search Box */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">지급 대상 사원 선택</label>
                    <div className="relative group">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground/20 group-focus-within:text-emerald-500 transition-colors z-10" />
                      <Input 
                        placeholder="사원 이름 또는 사번으로 검색..." 
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (selectedUser) setSelectedUser('');
                        }}
                        className="h-16 pl-16 bg-muted border-2 border-transparent focus:border-emerald-500 focus:bg-card rounded-2xl font-black text-lg transition-all shadow-inner placeholder:text-muted-foreground/20 text-foreground"
                      />
                    </div>

                    {/* Result or Selection Display */}
                    <div className="min-h-[160px]">
                      {selectedUser ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          {(() => {
                            const user = users.find(u => u.uid === selectedUser);
                            if (!user) return null;
                            return (
                              <div className="flex flex-col items-center text-center p-8 bg-muted rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-border">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform" />
                                
                                <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center border-4 border-border mb-4 shadow-2xl">
                                  <span className="text-3xl font-black text-foreground">{user.displayName.charAt(0)}</span>
                                </div>
                                
                                <h4 className="text-2xl font-black text-foreground tracking-tight">{user.displayName}</h4>
                                <p className="text-muted-foreground font-extrabold text-[11px] uppercase tracking-[0.2em] mt-1">
                                  {user.departmentName} | {user.employeeId}
                                </p>
                                
                                <Badge className="mt-4 bg-emerald-500 text-white font-black px-4 py-1.5 rounded-xl border-none shadow-lg">
                                  지급 대상 확정
                                </Badge>

                                <button 
                                  onClick={() => setSelectedUser('')}
                                  className="absolute top-6 right-6 w-10 h-10 bg-card hover:bg-muted rounded-full flex items-center justify-center transition-colors border border-border"
                                >
                                  <XCircle className="w-5 h-5 text-muted-foreground" />
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      ) : searchQuery.length > 0 ? (
                        <div className="grid gap-3 max-h-[300px] overflow-y-auto no-scrollbar py-2">
                          {users
                            .filter(u => u.uid !== profile?.uid)
                            .filter(u => {
                              const query = searchQuery.toLowerCase();
                              return (u.displayName?.toLowerCase() || '').includes(query) || 
                                     u.employeeId?.toLowerCase().includes(query) ||
                                     u.departmentName?.toLowerCase().includes(query);
                            }).length === 0 ? (
                              <div className="py-20 flex flex-col items-center gap-3 opacity-30">
                                <Search className="w-12 h-12 text-muted-foreground/10" />
                                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">일치하는 사원이 없습니다</p>
                              </div>
                            ) : (
                              users
                                .filter(u => u.uid !== profile?.uid)
                                .filter(u => {
                                  const query = searchQuery.toLowerCase();
                                  return (u.displayName?.toLowerCase() || '').includes(query) || 
                                         u.employeeId?.toLowerCase().includes(query) ||
                                         u.departmentName?.toLowerCase().includes(query);
                                })
                                .map((user) => (
                                  <button
                                    key={user.uid}
                                    onClick={() => {
                                      setSelectedUser(user.uid);
                                      setSearchQuery('');
                                    }}
                                    className="w-full flex items-center justify-between p-6 rounded-[2rem] border-2 border-transparent bg-muted/50 hover:border-emerald-500 hover:bg-muted transition-all duration-300 group shadow-sm hover:shadow-xl"
                                  >
                                    <div className="flex items-center gap-4 text-left">
                                       <div className="w-12 h-12 bg-card rounded-xl flex items-center justify-center font-black text-xl border-2 border-border text-muted-foreground/20 shadow-sm group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all">
                                         {user.displayName?.charAt(0) || '?'}
                                       </div>
                                       <div className="flex flex-col">
                                         <div className="flex items-center gap-2">
                                           <span className="font-black text-base text-foreground tracking-tight">{user.displayName}</span>
                                           <Badge className="bg-muted text-muted-foreground text-[8px] font-black">{user.role}</Badge>
                                         </div>
                                         <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{user.employeeId} | {user.departmentName}</span>
                                       </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground/20 group-hover:text-emerald-500 transition-all" />
                                  </button>
                                ))
                            )}
                        </div>
                      ) : (
                        <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 bg-muted/30 border-2 border-dashed border-border rounded-[2.5rem]">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center shadow-sm">
                            <User className="w-8 h-8 text-muted-foreground/10" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">사원을 선택해 주세요</p>
                            <p className="text-[9px] font-bold text-muted-foreground/10 uppercase tracking-[0.2em]">이름 또는 사번으로 검색</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">날짜</label>
                      <Input type="date" value={giveCouponForm.date} onChange={e => setGiveCouponForm({...giveCouponForm, date: e.target.value})} className="h-14 bg-muted border-border rounded-2xl font-bold border-2 text-foreground" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">시간</label>
                      <Input type="time" value={giveCouponForm.time} onChange={e => setGiveCouponForm({...giveCouponForm, time: e.target.value})} className="h-14 bg-muted border-border rounded-2xl font-bold border-2 text-foreground" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">발생 장소</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/20" />
                      <Input placeholder="사무실, 현장 등" value={giveCouponForm.location} onChange={e => setGiveCouponForm({...giveCouponForm, location: e.target.value})} className="h-14 pl-14 bg-muted border-border rounded-2xl font-bold border-2 text-foreground placeholder:text-muted-foreground/20" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">보너스 포인트</label>
                    <Select value={String(giveCouponForm.points)} onValueChange={v => setGiveCouponForm({...giveCouponForm, points: parseInt(v)})}>
                      <SelectTrigger className="h-14 bg-muted border-border rounded-2xl font-black border-2 text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card rounded-2xl border-border text-foreground">
                        {[1, 2, 3, 5, 10].map(p => (
                          <SelectItem key={p} value={String(p)} className="font-bold">{p}P ({(p * 5000).toLocaleString()}원)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">현장 사진 첨부 (선택사항)</label>
                    <Input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (uploadEvent) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              let width = img.width;
                              let height = img.height;
                              const MAX_WIDTH = 600;
                              const MAX_HEIGHT = 600;
                              if (width > height) {
                                if (width > MAX_WIDTH) {
                                  height *= MAX_WIDTH / width;
                                  width = MAX_WIDTH;
                                }
                              } else {
                                if (height > MAX_HEIGHT) {
                                  width *= MAX_HEIGHT / height;
                                  height = MAX_HEIGHT;
                                }
                              }
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx?.drawImage(img, 0, 0, width, height);
                              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                              setGiveCouponForm(prev => ({ ...prev, photoUrl: dataUrl }));
                              toast.success('사진이 압축 및 첨부되었습니다.');
                            };
                            img.src = uploadEvent.target?.result as string;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="h-14 bg-muted border-2 border-border rounded-2xl text-xs font-bold text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-500 file:text-white cursor-pointer"
                    />
                    {giveCouponForm.photoUrl && (
                      <div className="mt-2 relative w-20 h-20 rounded-2xl overflow-hidden border border-border shadow-md">
                        <img src={giveCouponForm.photoUrl} alt="Attached Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setGiveCouponForm({ ...giveCouponForm, photoUrl: '' })}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">칭찬 사유</label>
                    <textarea 
                      placeholder="사원에게 전달될 칭찬 사유를 정성껏 작성해주세요" 
                      value={giveCouponForm.reason} 
                      onChange={e => setGiveCouponForm({...giveCouponForm, reason: e.target.value})}
                      className="w-full h-40 p-5 bg-muted border-2 border-border rounded-[2rem] font-bold text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-foreground placeholder:text-muted-foreground/20"
                    />
                  </div>

                  <Button onClick={handleGiveCoupon} className="w-full h-16 rounded-[2rem] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 mt-4">
                    쿠폰 발송하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between">
              <span className="text-xs font-black text-muted-foreground">조회 월 선택</span>
              <input 
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-muted px-4 py-2 rounded-xl text-xs font-black border border-border text-foreground"
              />
            </div>

            <div className="flex items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-5 bg-primary rounded-full" />
                <h3 className="text-base font-black text-foreground uppercase tracking-widest">지급 내역 ({selectedMonth})</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportCouponsToPDF}
                  className="h-11 px-4 gap-2 font-black rounded-2xl border-border bg-muted hover:bg-card text-foreground shadow-sm flex items-center"
                >
                  <FileText className="w-4 h-4 text-rose-500" /> PDF 저장
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportCouponsToExcel}
                  className="h-11 px-4 gap-2 font-black rounded-2xl border-border bg-muted hover:bg-card text-foreground shadow-sm flex items-center"
                >
                  <Download className="w-4 h-4 text-emerald-500" /> 엑셀 저장
                </Button>
              </div>
            </div>

            <Card className="border-none shadow-xl bg-card rounded-[2rem] overflow-hidden border border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 border-border hover:bg-transparent">
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5 pl-8">일시</TableHead>
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5">대상자</TableHead>
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5 text-center">포인트</TableHead>
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5 text-center">현장사진</TableHead>
                        <TableHead className="text-[11px] font-black text-muted-foreground uppercase tracking-widest py-5 pr-8">사유</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold">로딩 중...</TableCell>
                        </TableRow>
                      ) : filteredCouponHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic uppercase tracking-widest">해당 월의 데이터가 없습니다.</TableCell>
                        </TableRow>
                      ) : (
                        filteredCouponHistory.map((c) => (
                          <TableRow key={c.id} className="border-border hover:bg-muted/50 transition-colors">
                            <TableCell className="pl-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-foreground">{c.date}</span>
                                <span className="text-[10px] font-bold text-muted-foreground mt-1">{c.time}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-foreground">{c.receiverName}</span>
                                <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{users.find(u => u.uid === c.receiverUid)?.position || '사원'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-5 font-black text-emerald-500 text-sm text-center">+{c.points}P</TableCell>
                            <TableCell className="py-5 text-center">
                              {c.photoUrl ? (
                                <img src={c.photoUrl} alt="coupon-photo" className="w-10 h-10 rounded-xl object-cover mx-auto border border-border shadow-xs" />
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="pr-8 py-5">
                              <p className="text-[11px] font-bold text-muted-foreground line-clamp-2 max-w-[150px] leading-relaxed">{c.reason}</p>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 px-2">
              <div className="w-2 h-5 bg-primary rounded-full" />
              <h3 className="text-base font-black text-foreground uppercase tracking-widest">환경 설정</h3>
            </div>

            <Card className="border-none shadow-2xl bg-card rounded-[2.5rem] overflow-hidden border border-border">
              <CardHeader className="p-8 pb-4 text-center border-b border-border">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <CardTitle className="text-xl font-black text-foreground">룰렛 당첨 확률</CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-10 space-y-8">
                <div className="space-y-5">
                  {rouletteSettings.map((s) => (
                    <div key={s.id} className="flex flex-col gap-3 bg-muted/30 p-6 rounded-[2rem] border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl shadow-sm border-2 border-border flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <div className="flex flex-col">
                             <span className="text-base font-black text-foreground">{s.label}</span>
                             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{s.multiplier}x Multiplier</span>
                          </div>
                        </div>
                        <div className="w-28 relative">
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={s.probability} 
                            onChange={e => updateProbability(s.id, e.target.value)} 
                            className="h-12 bg-card border-2 border-border rounded-2xl text-center font-black pr-10 focus:ring-primary text-foreground" 
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground/20">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-8">
                    <div className="p-8 bg-muted rounded-[2.5rem] shadow-2xl text-center space-y-4 border border-border">
                        <div className="flex flex-col items-center gap-2">
                           <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">System Integrity Check</span>
                           <div className="flex items-center gap-2 bg-card px-3 py-1 rounded-full border border-border">
                              <div className={cn("w-2 h-2 rounded-full", isProbValid ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                              <span className={cn("text-[10px] font-extrabold uppercase", isProbValid ? "text-emerald-400" : "text-red-400")}>
                                {isProbValid ? "VALID" : "INVALID"}
                              </span>
                           </div>
                        </div>
                        <div className={cn("text-5xl font-black transition-colors duration-700", isProbValid ? "text-foreground" : "text-red-500")}>
                           {(totalProb * 100).toFixed(0)}<span className="text-2xl ml-1">%</span>
                        </div>
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground font-bold mt-6 tracking-wide leading-relaxed">
                      모든 확률의 합계는 <span className="text-foreground underline">반드시 100%</span>가 되어야 시스템이 정상 작동합니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
};
