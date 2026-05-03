import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  LayoutDashboard,
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
  { id: 'work_log_mgmt', label: '작업일지 관리', icon: ClipboardList },
  { id: 'training_mgmt', label: '교육/평가 관리', icon: HardHat },
  { id: 'safety_score_admin', label: '안전지수 설정/관리', icon: ShieldCheck },
  { id: 'pc_dashboard', label: 'PC 통합 대시보드', icon: LayoutDashboard, color: 'bg-emerald-600' },
  { id: 'payslip_mgmt', label: '급여명세서 관리', icon: CircleDollarSign },
  { id: 'safety_ranking', label: '나의 안전지수/랭킹 조회', icon: BarChart3 },
  { id: 'qualification_mgmt', label: '자격/교육이력 관리', icon: ClipboardList },
  { id: 'high_work_monitor', label: '고소작업 총괄 현황', icon: BarChart3 },
  { id: 'emergency_rollcall', label: '비상 대피 롤콜 권한', icon: AlertTriangle },
];

import { GlowLoading } from '@/src/components/GlowLoading';

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
    
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      await minLoadTime;
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

  const categorizedLinks = {
    hr: [
      { to: '/personnel', label: '인사등록', icon: UserPlus, permission: 'employee_mgmt' },
      { to: '/attendance-mgmt', label: '근태 관리', icon: Clock, permission: 'attendance_mgmt' },
      { to: '/leave-mgmt', label: '연차/휴가 관리', icon: CalendarDays, permission: 'leave_mgmt' },
      { to: '/payslip-mgmt', label: '급여명세서 관리', icon: CircleDollarSign, permission: 'payslip_mgmt' },
      { to: '/work-log-mgmt', label: '작업일지 관리', icon: ClipboardList, permission: 'work_log_mgmt' },
      { to: '/qualification', label: '자격/교육이력 관리', icon: ClipboardList, permission: 'qualification_mgmt' },
      { to: '/redemption-mgmt', label: '현물 신청 관리', icon: CircleDollarSign, permission: 'redemption_mgmt' },
    ],
    safety: [
      { onClick: () => navigate('/high-work-monitor'), label: '고소작업 총괄 현황', icon: BarChart3, permission: 'high_work_monitor' },
      { onClick: () => setIsEmergencyOpen(true), label: '비상 대피 롤콜', icon: AlertTriangle, permission: 'emergency_rollcall' },
      { to: '/accidents', label: '사고즉보 관리', icon: ShieldAlert, permission: 'accident_mgmt' },
      { to: '/training-mgmt', label: '교육/평가 관리', icon: HardHat, permission: 'training_mgmt' },
      { to: '/safety-score', label: '나의 안전지수/랭킹 조회', icon: BarChart3, permission: 'safety_ranking' },
      { to: '/safety-score', label: '안전지수 설정', icon: ShieldCheck, permission: 'safety_score_admin' },
    ],
    system: [
      { to: '/admin/pc-dashboard', label: 'PC 통합 대시보드', icon: LayoutDashboard, permission: 'admin', newTab: true },
      { to: '/notifications', label: '공지사항 관리', icon: Megaphone, permission: 'notice_mgmt' },
      { onClick: () => setIsBannerSettingsOpen(true), label: '메인 배너 문구', icon:Megaphone, permission: 'admin' },
      { to: '/coupons', label: '포상/룰렛 관리', icon: Trophy, permission: 'praise_coupon' },
      { onClick: () => setIsShipSettingsOpen(true), label: '함선 파츠 확률', icon: Ship, permission: 'admin' },
      { onClick: () => setIsSnailSettingsOpen(true), label: '달팽이 경주 설정', icon: Zap, permission: 'admin' },
      { onClick: () => setIsPermissionSettingsOpen(true), label: '사용자 권한 명단', icon: ShieldCheck, permission: 'admin' },
    ]
  };

  const renderLink = (link: any, idx: number) => {
    const isAllowed = isAdminMode || 
      (link.roles && profile && link.roles.includes(profile.role)) ||
      (link.permission && profile && profile.permissions?.includes(link.permission)) ||
      (!link.roles && !link.permission);

    if (!isAllowed) return null;

    const Content = (
      <div className="bg-card p-4 rounded-2xl border border-white/5 flex items-center gap-4 active:scale-95 transition-all w-full text-left">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
          <link.icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-black text-white leading-tight">{link.label}</span>
      </div>
    );

    return 'to' in link ? (
      <Link 
        key={idx} 
        to={link.to} 
        className="w-full"
        target={link.newTab ? "_blank" : undefined}
        rel={link.newTab ? "noopener noreferrer" : undefined}
      >
        {Content}
      </Link>
    ) : (
      <button key={idx} onClick={link.onClick} className="w-full">{Content}</button>
    );
  };

  if (loading) return <GlowLoading message="ADMIN" subMessage="Scanning Authority..." />;

  const isAdminMode = profile && (
    profile.role === 'CEO' || 
    profile.permissions?.includes('admin') ||
    profile.email === 'tjrwnfjqm1@gmail.com'
  );

  return (
    <div className="space-y-8 pb-24 px-1">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">Admin OS</h2>
        <p className="text-muted-foreground font-bold">건명기업 시스템의 코어 설정을 제어합니다</p>
      </header>

      {/* HR & Personnel Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">인사 및 현장 행정</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categorizedLinks.hr.map((link, idx) => renderLink(link, idx))}
        </div>
      </section>

      {/* Smart Safety Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <HardHat className="w-4 h-4 text-emerald-500" />
          <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">스마트 안전 관제</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categorizedLinks.safety.map((link, idx) => renderLink(link, idx))}
        </div>
      </section>

      {/* System & Rewards Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Settings className="w-4 h-4 text-primary" />
          <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">시스템 및 보상 설정</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categorizedLinks.system.map((link, idx) => renderLink(link, idx))}
        </div>
      </section>

      <Dialog open={isShipSettingsOpen} onOpenChange={setIsShipSettingsOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-md overflow-y-auto max-h-[85vh] p-6 focus:outline-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">함선 파츠 확률 설정</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground mt-1">
              활동(근태, 작업 등) 완료 시 파츠가 지급될 기본 확률과 특정 파츠의 지급 여부를 설정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 border-y border-white/5 my-4">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <Label className="text-[10px] font-black text-primary uppercase tracking-widest">기본 지급 확률</Label>
                <span className="text-xl font-black text-white">{(shipSettings.probability * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={shipSettings.probability} 
                onChange={e => setShipSettings(prev => ({ ...prev, probability: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none accent-primary" 
              />
              <p className="text-[10px] font-bold text-muted-foreground text-center italic">
                * 100% 설정 시 모든 활동 완료 시 확정적으로 지급됩니다.
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">파츠 활성화 관리</Label>
              <div className="grid grid-cols-2 gap-2">
                {SHIP_PARTS.map(part => {
                  const isDisabled = shipSettings.disabledParts.includes(part.id);
                  return (
                    <button
                      key={part.id}
                      onClick={() => {
                        const newDisabled = isDisabled 
                          ? shipSettings.disabledParts.filter(id => id !== part.id)
                          : [...shipSettings.disabledParts, part.id];
                        setShipSettings(prev => ({ ...prev, disabledParts: newDisabled }));
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        isDisabled 
                          ? "bg-red-500/5 border-red-500/20 text-red-500 grayscale" 
                          : "bg-white/5 border-white/5 text-white"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        isDisabled ? "bg-red-500/10" : "bg-primary/10"
                      )}>
                        <Ship className={cn("w-4 h-4", isDisabled ? "text-red-500" : "text-primary")} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black truncate">{part.name}</p>
                        <p className={cn("text-[9px] font-bold", isDisabled ? "text-red-500/60" : "text-muted-foreground")}>
                          {isDisabled ? '중지됨' : '정상지급'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-14 rounded-2xl border-white/10 text-white font-black"
              onClick={() => setIsShipSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'shipParts'), {
                    probability: shipSettings.probability,
                    disabledParts: shipSettings.disabledParts,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('함선 파츠 확률 설정이 저장되었습니다.');
                  setIsShipSettingsOpen(false);
                } catch (e) {
                  toast.error('설정 저장 중 오류가 발생했습니다.');
                }
              }}
            >
              설정 저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
