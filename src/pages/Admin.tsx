import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SHIP_PARTS } from '@/src/services/shipService';
import { 
  Users, 
  ShieldCheck, 
  Settings, 
  Megaphone, 
  ShieldAlert, 
  AlertTriangle,
  BarChart3,
  CalendarDays, 
  Trophy,
  Search,
  CheckCircle2,
  ChevronRight,
  UserPlus,
  Zap,
  Save,
  Ship,
  Eye,
  EyeOff,
  HardHat,
  CircleDollarSign,
  Clock,
  ClipboardList
} from 'lucide-react';
import { db } from '@/src/firebase';
import { collection, query, onSnapshot, updateDoc, doc, setDoc } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';

const PERMISSIONS = [
  { id: 'admin', label: '시스템 관리 접근', icon: Settings },
  { id: 'employee_mgmt', label: '인사등록 (사원/부서)', icon: Users },
  { id: 'notice_mgmt', label: '공지사항 관리', icon: Megaphone },
  { id: 'accident_mgmt', label: '사고즉보 관리', icon: ShieldAlert },
  { id: 'leave_mgmt', label: '연차/휴가 관리', icon: CalendarDays },
  { id: 'dept_mgmt', label: '조직 관리', icon: CheckCircle2 },
  { id: 'praise_coupon', label: '칭찬쿠폰/룰렛 관리', icon: Trophy },
  { id: 'redemption_mgmt', label: '현물 신청 관리', icon: CircleDollarSign },
  { id: 'attendance_mgmt', label: '근태 관리', icon: Clock },
];

export const Admin: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSnailSettingsOpen, setIsSnailSettingsOpen] = useState(false);
  const [isShipSettingsOpen, setIsShipSettingsOpen] = useState(false);
  const [isBannerSettingsOpen, setIsBannerSettingsOpen] = useState(false);
  const [isPermissionSettingsOpen, setIsPermissionSettingsOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [snailProbs, setSnailProbs] = useState<number[]>([1, 1, 1, 1, 1]);
  const [shipSettings, setShipSettings] = useState({
    probability: 0.3,
    disabledParts: [] as string[]
  });
  const [bannerText, setBannerText] = useState('안전한 하루가 되세요');
  const [evacuationStatus, setEvacuationStatus] = useState<any>(null);
  const [evacuationCheckins, setEvacuationCheckins] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    
    const unsubEvacuation = onSnapshot(doc(db, 'evacuation', 'status'), (snap) => {
      if (snap.exists()) {
        setEvacuationStatus(snap.data());
      } else {
        setEvacuationStatus(null);
      }
    });

    return () => unsubEvacuation();
  }, [profile]);

  useEffect(() => {
    if (evacuationStatus?.isActive) {
      const q = query(collection(db, 'evacuations', evacuationStatus.id, 'checkins'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setEvacuationCheckins(snapshot.docs.map(doc => doc.data()));
      });
      return () => unsubscribe();
    } else {
      setEvacuationCheckins([]);
    }
  }, [evacuationStatus?.isActive, evacuationStatus?.id]);

  useEffect(() => {
    if (!profile) return;
    
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
      setFilteredUsers(data);
      setLoading(false);
    }, (error) => {
      console.error("Users listener error (Admin):", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const unsubEntertainment = onSnapshot(doc(db, 'settings', 'entertainment'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.snailProbabilities) setSnailProbs(data.snailProbabilities);
      }
    }, (error) => console.error("Entertainment settings listener error (Admin):", error));

    const unsubShip = onSnapshot(doc(db, 'settings', 'shipParts'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setShipSettings({
          probability: data.probability ?? 0.3,
          disabledParts: data.disabledParts ?? []
        });
      }
    }, (error) => console.error("Ship settings listener error (Admin):", error));

    const unsubBanner = onSnapshot(doc(db, 'settings', 'banner'), (snapshot) => {
      if (snapshot.exists()) {
        setBannerText(snapshot.data().text || '안전한 하루가 되세요');
      }
    }, (error) => console.error("Banner settings listener error (Admin):", error));

    return () => {
      unsubEntertainment();
      unsubShip();
      unsubBanner();
    };
  }, [profile]);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleTogglePermission = async (userId: string, permissionId: string) => {
    const user = users.find(u => u.uid === userId);
    if (!user) return;
    const current = user.permissions || [];
    const updated = current.includes(permissionId) ? current.filter(p => p !== permissionId) : [...current, permissionId];
    try {
      await updateDoc(doc(db, 'users', userId), { permissions: updated });
      toast.success('권한 업데이트 완료');
    } catch (e) { toast.error('권한 업데이트 실패'); }
  };

  const managementLinks = [
    { to: '/personnel', label: '인사등록', icon: UserPlus, permission: 'employee_mgmt' },
    { to: '/training-mgmt', label: '교육/평가 관리', icon: HardHat, permission: 'training_mgmt' },
    { to: '/safety-score', label: '안전지수 점수 관리', icon: ShieldCheck, roles: ['CEO', 'SAFETY_MANAGER'] },
    { to: '/coupons', label: '칭찬쿠폰/룰렛 관리', icon: Trophy, permission: 'praise_coupon' },
    { to: '/redemption-mgmt', label: '현물 신청 관리', icon: CircleDollarSign, permission: 'redemption_mgmt' },
    { to: '/attendance-mgmt', label: '근태 관리', icon: Clock, permission: 'attendance_mgmt' },
    { to: '/work-log-mgmt', label: '작업일지 관리', icon: ClipboardList, roles: ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER'] },
    { to: '/leave-mgmt', label: '연차/휴가 관리', icon: CalendarDays, permission: 'leave_mgmt' },
    { to: '/notifications', label: '공지사항 관리', icon: Megaphone, permission: 'notice_mgmt' },
    { to: '/accidents', label: '사고즉보 관리', icon: ShieldAlert, permission: 'accident_mgmt' },
    { onClick: () => setIsBannerSettingsOpen(true), label: '메인 배너 관리', icon: Megaphone, permission: 'admin' },
    { onClick: () => setIsSnailSettingsOpen(true), label: '달팽이 경주 설정', icon: Zap, permission: 'admin' },
    { onClick: () => setIsShipSettingsOpen(true), label: '함선 부품 설정', icon: Ship, permission: 'admin' },
    { onClick: () => setIsPermissionSettingsOpen(true), label: '사용자 권한 명단', icon: ShieldCheck, permission: 'admin' },
    { onClick: () => navigate('/high-work-monitor'), label: '고소작업 실시간 현황', icon: BarChart3, roles: ['CEO', 'SAFETY_MANAGER'] },
    { onClick: () => setIsEmergencyOpen(true), label: '비상 대피 롤콜', icon: AlertTriangle, roles: ['CEO', 'SAFETY_MANAGER'] },
  ];

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const isAdminMode = profile && (
    profile.role === 'CEO' || 
    profile.permissions?.includes('admin') ||
    profile.email === 'tjrwnfjqm1@gmail.com'
  );

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">시스템 어드민</h2>
        <p className="text-muted-foreground font-bold">건명기업 시스템의 모든 설정을 관리하세요</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {managementLinks.filter(link => {
          if (isAdminMode) return true;
          if (link.roles && profile && link.roles.includes(profile.role)) return true;
          if (link.permission && profile && profile.permissions?.includes(link.permission)) return true;
          if (!link.roles && !link.permission) return true;
          return false;
        }).map((link, idx) => {
          const Content = (
            <div className="bg-card p-6 rounded-2xl border border-white/5 flex flex-col items-center gap-4 text-center active:scale-95 transition-all h-full">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <link.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-black text-white leading-tight">{link.label}</span>
            </div>
          );
          return 'to' in link ? <Link key={idx} to={link.to}>{Content}</Link> : <button key={idx} onClick={link.onClick}>{Content}</button>;
        })}
      </div>

      <Dialog open={isSnailSettingsOpen} onOpenChange={setIsSnailSettingsOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-sm">
           <DialogHeader><DialogTitle className="font-black">달팽이 확률 설정</DialogTitle></DialogHeader>
           <div className="space-y-4 py-4">
              {snailProbs.map((p, i) => (
                <div key={i} className="flex flex-col gap-2 p-4 bg-white/5 rounded-2xl">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground">
                      <span>{i+1}번 달팽이</span>
                      <span>{p.toFixed(1)}x</span>
                   </div>
                   <input type="range" min="0.5" max="3" step="0.1" value={p} onChange={e => {
                      const updated = [...snailProbs]; updated[i] = parseFloat(e.target.value); setSnailProbs(updated);
                   }} className="w-full h-2 bg-white/10 rounded-full appearance-none accent-primary" />
                </div>
              ))}
           </div>
           <Button className="w-full h-14 bg-primary text-white font-black rounded-2xl" onClick={async () => {
             await setDoc(doc(db, 'settings', 'entertainment'), { snailProbabilities: snailProbs }, { merge: true });
             toast.success('저장 완료'); setIsSnailSettingsOpen(false);
           }}>설정 저장</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isBannerSettingsOpen} onOpenChange={setIsBannerSettingsOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-sm">
           <DialogHeader><DialogTitle className="font-black">메인 배너 관리</DialogTitle></DialogHeader>
           <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">배너 문구</Label>
                <Input 
                  value={bannerText} 
                  onChange={(e) => setBannerText(e.target.value)}
                  className="bg-white/5 border-none h-12 rounded-xl text-white font-bold"
                  placeholder="예: 안전한 하루가 되세요"
                />
              </div>
           </div>
           <Button className="w-full h-14 bg-primary text-white font-black rounded-2xl" onClick={async () => {
             await setDoc(doc(db, 'settings', 'banner'), { 
               text: bannerText,
               updatedAt: new Date().toISOString(),
               updatedBy: profile?.uid
             }, { merge: true });
             toast.success('배너 문구가 저장되었습니다.'); 
             setIsBannerSettingsOpen(false);
           }}>저장하기</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermissionSettingsOpen} onOpenChange={setIsPermissionSettingsOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-md p-0 overflow-hidden flex flex-col max-h-[80vh]">
           <div className="p-8 pb-4">
              <DialogTitle className="font-black mb-4">권한 관리</DialogTitle>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <Input 
                  placeholder="사용자 검색..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="bg-white/5 border-none h-12 pl-11 rounded-xl" 
                />
              </div>
           </div>
           <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {(() => {
                const activeUser = selectedUser ? users.find(u => u.uid === selectedUser.uid) || selectedUser : null;
                
                if (activeUser) {
                  return (
                    <div className="space-y-4">
                       <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center font-black">
                               {activeUser.displayName.charAt(0)}
                             </div>
                             <div>
                               <p className="font-black text-sm">{activeUser.displayName}</p>
                               <p className="text-[10px] text-muted-foreground">{activeUser.employeeId}</p>
                             </div>
                          </div>
                          <Button variant="ghost" className="text-xs text-muted-foreground" onClick={() => setSelectedUser(null)}>변경</Button>
                       </div>
                       <div className="space-y-2">
                          {PERMISSIONS.map(p => {
                            const isGranted = activeUser.permissions?.includes(p.id);
                            return (
                              <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                 <div className="flex items-center gap-3">
                                   <p.icon className="w-4 h-4 text-primary" />
                                   <span className="text-xs font-bold">{p.label}</span>
                                 </div>
                                 <div 
                                   className={cn(
                                     "w-10 h-5 rounded-full p-1 cursor-pointer transition-all duration-200", 
                                     isGranted ? "bg-primary" : "bg-white/10"
                                   )} 
                                   onClick={() => handleTogglePermission(activeUser.uid, p.id)}
                                 >
                                    <div className={cn(
                                      "w-3 h-3 bg-white rounded-full transition-transform duration-200", 
                                      isGranted ? "translate-x-5" : "translate-x-0"
                                    )} />
                                 </div>
                              </div>
                            );
                          })}
                       </div>
                    </div>
                  );
                }

                return filteredUsers.slice(0, 10).map(u => (
                  <div 
                    key={u.uid} 
                    className="bg-white/5 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white/10 active:scale-95 transition-all" 
                    onClick={() => setSelectedUser(u)}
                  >
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center font-black text-sm text-muted-foreground">
                          {u.displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-sm">{u.displayName}</p>
                          <p className="text-[10px] text-muted-foreground">{u.employeeId}</p>
                        </div>
                     </div>
                     <ChevronRight className="w-4 h-4 text-white/20" />
                  </div>
                ));
              })()}
           </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-8 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-600/20 text-red-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="font-black text-xl">비상 대피 실시간 롤콜</DialogTitle>
                  <DialogDescription className="font-bold">현장 인원들의 안전을 실시간으로 확인합니다.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-6">
            {evacuationStatus?.isActive ? (
              <div className="space-y-6">
                {/* Real-time Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">확인 인원</p>
                    <p className="text-4xl font-black text-primary">{evacuationCheckins.length}</p>
                  </div>
                  <div className="bg-red-600/10 p-6 rounded-2xl border border-red-600/20 text-center">
                    <p className="text-[10px] font-black text-red-600/60 uppercase tracking-widest mb-1">미확인 인원</p>
                    <p className="text-4xl font-black text-red-600">
                      {Math.max(0, (evacuationStatus.totalWorkers || users.length) - evacuationCheckins.length)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-white/5 h-4 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(evacuationCheckins.length / (evacuationStatus.totalWorkers || users.length)) * 100}%` }}
                    className="h-full bg-primary"
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-black text-white px-1">미확인 인원 명단</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {users
                      .filter(u => !evacuationCheckins.some(c => c.uid === u.uid))
                      .map(user => (
                        <div key={user.uid} className="flex items-center justify-between p-4 bg-red-600/5 border border-red-600/10 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-600/20 text-red-600 rounded-lg flex items-center justify-center font-black text-xs">
                              {user.displayName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-sm text-red-600">{user.displayName}님</p>
                              <p className="text-[10px] text-red-400 font-bold">{user.departmentName || '소속 없음'}</p>
                            </div>
                          </div>
                          <Badge className="bg-red-600/20 text-red-600 border-none font-black text-[10px]">미확인</Badge>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-14 rounded-2xl border-white/10 text-white font-black"
                    onClick={() => setIsEmergencyOpen(false)}
                  >
                    닫기
                  </Button>
                  <Button 
                    className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black border border-white/5"
                    onClick={async () => {
                      if (window.confirm('대피 상황을 종료하시겠습니까?')) {
                        await updateDoc(doc(db, 'evacuation', 'status'), { isActive: false });
                        toast.success('대피 상황이 종료되었습니다.');
                      }
                    }}
                  >
                    상황 종료
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-4">
                <div className="p-6 bg-red-600/10 rounded-3xl border border-red-600/20 text-center space-y-2">
                  <p className="text-sm font-black text-red-600">현재 활성화된 대피령이 없습니다.</p>
                  <p className="text-xs font-bold text-red-400">비상 상황 발생 시 아래 버튼을 눌러 대피령을 발동하세요.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">대피 공지 사유</Label>
                  <Input 
                    placeholder="예: 제3도크 화재 발생, 즉시 대피 바랍니다."
                    className="bg-white/5 border-none h-14 rounded-2xl font-bold"
                    id="emergency-reason"
                  />
                </div>

                <Button 
                  className="w-full h-16 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-lg shadow-xl shadow-red-600/20"
                  onClick={async () => {
                    const reason = (document.getElementById('emergency-reason') as HTMLInputElement)?.value || '긴급 상황이 발생했습니다.';
                    const id = new Date().getTime().toString();
                    await setDoc(doc(db, 'evacuation', 'status'), {
                      id,
                      isActive: true,
                      activatedAt: new Date().toISOString(),
                      activatedByUid: profile?.uid,
                      activatedByName: profile?.displayName,
                      reason,
                      totalWorkers: users.length,
                      confirmedCount: 0
                    });
                    toast.error('비상 대피령이 발동되었습니다!');
                  }}
                >
                  비상 대피령 발동 (ROLL-CALL 시작)
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
