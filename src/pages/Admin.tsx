import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { SHIP_PARTS } from '@/src/services/shipService';
import { 
  Users, 
  ShieldCheck, 
  Settings, 
  Megaphone, 
  ShieldAlert, 
  CalendarDays, 
  Trophy,
  Search,
  CheckCircle2,
  XCircle,
  ChevronRight,
  UserPlus,
  Zap,
  Save,
  ChevronDown,
  User as UserIcon,
  Ship,
  Eye,
  EyeOff,
  HardHat
} from 'lucide-react';
import { db } from '@/src/firebase';
import { collection, query, onSnapshot, updateDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const PERMISSIONS = [
  { id: 'admin', label: '시스템 관리 접근', icon: Settings },
  { id: 'employee_mgmt', label: '인사등록 (사원/부서)', icon: Users },
  { id: 'notice_mgmt', label: '공지사항 관리', icon: Megaphone },
  { id: 'accident_mgmt', label: '사고즉보 관리', icon: ShieldAlert },
  { id: 'leave_mgmt', label: '연차/휴가 관리', icon: CalendarDays },
  { id: 'dept_mgmt', label: '조직 관리', icon: CheckCircle2 },
  { id: 'praise_coupon', label: '칭찬쿠폰/룰렛 관리', icon: Trophy },
];

export const Admin: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSnailSettingsOpen, setIsSnailSettingsOpen] = useState(false);
  const [isShipSettingsOpen, setIsShipSettingsOpen] = useState(false);
  const [isPermissionSettingsOpen, setIsPermissionSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Snail Race Settings
  const [snailProbs, setSnailProbs] = useState<number[]>([1, 1, 1, 1, 1]);
  const [isSavingSnail, setIsSavingSnail] = useState(false);

  // Ship Part Settings
  const [shipSettings, setShipSettings] = useState({
    probability: 0.3,
    disabledParts: [] as string[]
  });
  const [isSavingShip, setIsSavingShip] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(userData);
      setFilteredUsers(userData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'entertainment'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.snailProbabilities) {
          setSnailProbs(data.snailProbabilities);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'shipParts'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setShipSettings({
          probability: data.probability ?? 0.3,
          disabledParts: data.disabledParts ?? []
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.departmentName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleTogglePermission = async (userId: string, permissionId: string) => {
    const user = users.find(u => u.uid === userId);
    if (!user) return;

    const currentPermissions = user.permissions || [];
    const newPermissions = currentPermissions.includes(permissionId)
      ? currentPermissions.filter(p => p !== permissionId)
      : [...currentPermissions, permissionId];

    try {
      await updateDoc(doc(db, 'users', userId), {
        permissions: newPermissions
      });
      toast.success('권한이 업데이트되었습니다.');
    } catch (error) {
      toast.error('권한 업데이트 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateSnailProbs = async () => {
    setIsSavingSnail(true);
    try {
      await setDoc(doc(db, 'settings', 'entertainment'), {
        snailProbabilities: snailProbs
      }, { merge: true });
      toast.success('달팽이 경주 설정이 저장되었습니다.');
    } catch (error) {
      toast.error('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingSnail(false);
    }
  };

  const handleUpdateShipSettings = async () => {
    setIsSavingShip(true);
    try {
      await setDoc(doc(db, 'settings', 'shipParts'), shipSettings, { merge: true });
      toast.success('함선 부품 설정이 저장되었습니다.');
    } catch (error) {
      toast.error('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingShip(false);
    }
  };

  const managementLinks = [
    { to: '/personnel', label: '인사등록', icon: UserPlus, permission: 'employee_mgmt' },
    { to: '/training-mgmt', label: '교육/평가 관리', icon: HardHat, permission: 'training_mgmt' },
    { to: '/safety-score', label: '안전지수 점수 관리', icon: ShieldCheck, roles: ['CEO', 'SAFETY_MANAGER'] },
    { to: '/coupons', label: '칭찬쿠폰/룰렛 관리', icon: Trophy, permission: 'praise_coupon' },
    { to: '/leave', label: '연차/휴가 관리', icon: CalendarDays, permission: 'leave_mgmt' },
    { to: '/notifications', label: '공지사항 관리', icon: Megaphone, permission: 'notice_mgmt' },
    { to: '/accidents', label: '사고즉보 관리', icon: ShieldAlert, permission: 'accident_mgmt' },
    { onClick: () => setIsSnailSettingsOpen(true), label: '달팽이 경주 설정', icon: Zap, permission: 'admin' },
    { onClick: () => setIsShipSettingsOpen(true), label: '함선 부품 설정', icon: Ship, permission: 'admin' },
    { onClick: () => setIsPermissionSettingsOpen(true), label: '사용자 권한 명단', icon: ShieldCheck, permission: 'admin' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasAdminAccess = profile && (['CEO', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('admin'));

  if (!hasAdminAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-black tracking-tight">접근 권한이 없습니다.</h2>
        <p className="text-slate-500 font-bold">관리자에게 문의하세요.</p>
        <Button onClick={() => window.history.back()}>뒤로 가기</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Branding Header */}
      <header className="flex flex-col gap-3 items-center text-center py-6 w-full">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-4 bg-white px-8 py-3 rounded-full shadow-xl border border-slate-100 ring-2 ring-primary/5"
        >
          <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
          <h2 className="text-2xl font-black tracking-tighter text-slate-900 italic">건명기업 관리자</h2>
        </motion.div>
        <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.4em] leading-none">System Administration Control</p>
      </header>

      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> 시스템 관리
        </h2>
        <p className="text-slate-600 font-bold text-sm">기능별 권한 설정 및 시스템 관리</p>
      </div>

      {/* System Management Menu */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">시스템 관리 메뉴</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {managementLinks.filter(link => {
            if (link.roles && profile && link.roles.includes(profile.role)) return true;
            if (link.permission && profile && profile.permissions?.includes(link.permission)) return true;
            if (!link.roles && !link.permission) return true;
            return false;
          }).map((link, idx) => {
            const content = (
              <Card className="border-none shadow-sm bg-white group-hover:shadow-md group-hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden h-full">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                    <link.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-900 leading-tight">{link.label}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Management</p>
                  </div>
                </CardContent>
              </Card>
            );

            if ('to' in link) {
              return (
                <Link key={idx} to={link.to} className="block group h-full">
                  {content}
                </Link>
              );
            } else {
              return (
                <button key={idx} onClick={link.onClick} className="block group text-left h-full w-full">
                  {content}
                </button>
              );
            }
          })}
        </div>
      </div>

      {/* Snail Race Settings Dialog */}
      <Dialog open={isSnailSettingsOpen} onOpenChange={setIsSnailSettingsOpen}>
        <DialogContent className="bg-white border-none rounded-[2.5rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh]">
          <div className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-8 pb-4 bg-slate-50 border-b border-slate-100 text-left shrink-0">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                      <HardHat className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-base tracking-tighter leading-none text-slate-900">건명기업</span>
                      <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mt-0.5">Kunmyung Enterprise</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsSnailSettingsOpen(false)} className="rounded-full bg-slate-200 text-slate-500">
                    <XCircle className="w-5 h-5" />
                  </Button>
               </div>
               <DialogTitle className="text-2xl font-black tracking-tighter text-slate-900">달팽이 경주 설정</DialogTitle>
               <DialogDescription className="text-slate-500 font-bold italic">Snail Race Winning Weighted Settings</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-6">
              <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-100/30">
                <p className="text-xs font-bold text-orange-600 leading-relaxed italic">
                  * 가중치가 높을수록 해당 달팽이의 평균 전진 속도가 빨라집니다. (기본값: 1.0)
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5">
                {snailProbs.map((prob, idx) => (
                  <div key={idx} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 space-y-5 shadow-inner">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-slate-100">
                          🐌
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{idx+1}번 달팽이</span>
                          <span className="text-sm font-black text-slate-900">전진 속도 가중치</span>
                        </div>
                      </div>
                      <Badge className="bg-primary text-white text-lg font-black px-4 py-1.5 rounded-full shadow-lg shadow-primary/20">{prob.toFixed(1)}x</Badge>
                    </div>
                    <input 
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.1"
                      value={prob}
                      onChange={(e) => {
                        const newProbs = [...snailProbs];
                        newProbs[idx] = parseFloat(e.target.value) || 1;
                        setSnailProbs(newProbs);
                      }}
                      className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
              <Button 
                onClick={handleUpdateSnailProbs} 
                disabled={isSavingSnail}
                className="w-full h-16 rounded-[1.5rem] bg-slate-900 font-black gap-2 transition-all active:scale-[0.98] shadow-xl text-lg text-white"
              >
                {isSavingSnail ? "저장 중..." : <><Save className="w-5 h-5" /> 확률 설정 저장하기</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ship Part Settings Dialog */}
      <Dialog open={isShipSettingsOpen} onOpenChange={setIsShipSettingsOpen}>
        <DialogContent className="bg-white border-none rounded-[2.5rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh]">
          <div className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-8 pb-4 bg-slate-50 border-b border-slate-100 text-left shrink-0">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                      <HardHat className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-base tracking-tighter leading-none text-slate-900">건명기업</span>
                      <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mt-0.5">Kunmyung Enterprise</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsShipSettingsOpen(false)} className="rounded-full bg-slate-100 text-slate-400">
                    <XCircle className="w-5 h-5" />
                  </Button>
               </div>
               <DialogTitle className="text-2xl font-black tracking-tighter text-slate-900">함선 부품 설정</DialogTitle>
               <DialogDescription className="text-slate-500 font-bold italic">Ship Parts Probability and Visibility</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-8 bg-white">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    부품 획득 확률 (0 ~ 1.0)
                  </label>
                  <Badge variant="outline" className="text-[#0066CC] border-[#0066CC]/30 font-black px-3 py-1 rounded-full uppercase text-[9px]">PROBABILITY</Badge>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                  <div className="relative flex-1">
                    <Input 
                      type="number" 
                      step="0.05"
                      min="0"
                      max="1"
                      value={shipSettings.probability}
                      onChange={(e) => setShipSettings({...shipSettings, probability: parseFloat(e.target.value) || 0})}
                      className="bg-white border-slate-200 font-black h-16 rounded-2xl w-full text-center text-2xl shadow-sm focus:border-[#0066CC] transition-colors"
                    />
                  </div>
                  <div className="text-3xl font-black text-[#0066CC] shrink-0 tracking-tighter">
                    {Math.round(shipSettings.probability * 100)}%
                  </div>
                </div>
              </div>

              <div className="space-y-4 pb-12">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 text-red-500">
                    <EyeOff className="w-4 h-4" /> 부품 비활성화 (보상 제외)
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {SHIP_PARTS.map((part) => {
                    const isDisabled = shipSettings.disabledParts.includes(part.id);
                    return (
                      <button
                        key={part.id}
                        onClick={() => {
                          const newDisabled = isDisabled
                            ? shipSettings.disabledParts.filter(id => id !== part.id)
                            : [...shipSettings.disabledParts, part.id];
                          setShipSettings({...shipSettings, disabledParts: newDisabled});
                        }}
                        className={cn(
                          "h-16 rounded-[1.75rem] font-black text-sm flex items-center justify-between px-6 transition-all active:scale-[0.98] border-2",
                          isDisabled 
                            ? "bg-red-50 border-red-100 text-red-500" 
                            : "bg-white border-slate-100 text-slate-600 hover:border-[#0066CC] hover:bg-[#0066CC]/5"
                        )}
                      >
                        <div className="flex items-center gap-4">
                           <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors", isDisabled ? "bg-white" : "bg-slate-50")}>
                               {isDisabled ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5 text-slate-400" />}
                           </div>
                           <span className="truncate">{part.name}</span>
                        </div>
                        {isDisabled && <Badge className="bg-red-500 text-white font-black text-[9px] rounded-lg">비활성</Badge>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <DialogFooter className="shrink-0 p-8 bg-slate-50 border-t border-slate-100 pb-10">
              <Button 
                onClick={handleUpdateShipSettings} 
                disabled={isSavingShip}
                className="w-full h-16 rounded-[1.5rem] bg-[#0066CC] font-black gap-2 transition-all active:scale-[0.98] shadow-2xl shadow-[#0066CC]/20 text-lg text-white"
              >
                {isSavingShip ? "저장 중..." : <><Save className="w-5 h-5" /> 함선 설정 저장하기</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Permission Settings Dialog */}
      <Dialog open={isPermissionSettingsOpen} onOpenChange={setIsPermissionSettingsOpen}>
        <DialogContent className="bg-white border-none rounded-[2.5rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden flex flex-col max-h-[90dvh]">
          <div className="flex flex-col h-full overflow-hidden">
            {/* Sticky Search Header */}
            <DialogHeader className="p-8 pb-6 bg-slate-50 border-b border-slate-100 text-left shrink-0">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                      <HardHat className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-base tracking-tighter leading-none text-slate-900">건명기업</span>
                      <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mt-0.5">Kunmyung Enterprise</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsPermissionSettingsOpen(false)} className="rounded-full bg-slate-100 text-slate-400">
                    <XCircle className="w-5 h-5" />
                  </Button>
               </div>
               <DialogTitle className="text-2xl font-black tracking-tighter text-slate-900 leading-none mb-4 uppercase">사용자 권한 명단</DialogTitle>
               
               <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-primary transition-colors z-10" />
                  <Input 
                    placeholder="사용자 이름 또는 사번으로 검색..." 
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (selectedUser) setSelectedUser(null);
                    }}
                    className="h-16 pl-16 bg-white border-2 border-slate-200 focus:border-primary rounded-2xl font-black text-lg transition-all shadow-sm placeholder:text-slate-300"
                  />
               </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
               {selectedUser ? (
                 <div className="p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Selected User Profiling */}
                    <div className="flex flex-col items-center text-center p-10 bg-slate-900 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 transition-transform group-hover:scale-110 duration-1000" />
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => setSelectedUser(null)}
                         className="absolute top-6 right-6 text-white/30 hover:text-white hover:bg-white/10 rounded-full"
                       >
                         <ChevronRight className="w-5 h-5 rotate-180" />
                       </Button>

                       <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center border-8 border-white/5 mb-6 shadow-2xl">
                          <span className="text-4xl font-black text-white">{selectedUser.displayName.charAt(0)}</span>
                       </div>
                       <h4 className="text-2xl font-black text-white tracking-tight leading-none mb-2">{selectedUser.displayName}</h4>
                       <p className="text-slate-400 font-extrabold text-[11px] uppercase tracking-[0.3em]">{selectedUser.employeeId} | {selectedUser.departmentName || 'DEPARTMENT'}</p>
                    </div>

                    {/* Permissions Gating */}
                    <div className="space-y-6">
                       <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className="w-6 h-6 text-primary" />
                            <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">접근 권한 관리</h5>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-none font-black px-3 py-1 rounded-full text-[9px]">Permissions</Badge>
                       </div>

                       <div className="grid gap-4">
                          {PERMISSIONS.map((perm) => {
                            const isGranted = selectedUser.permissions?.includes(perm.id);
                            return (
                              <button
                                key={perm.id}
                                onClick={() => handleTogglePermission(selectedUser.uid, perm.id)}
                                className={cn(
                                  "flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all duration-300 group shadow-sm hover:shadow-md",
                                  isGranted 
                                    ? "bg-white border-primary" 
                                    : "bg-slate-50 border-transparent hover:border-slate-200"
                                )}
                              >
                                <div className="text-left flex items-center gap-5">
                                  <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                                    isGranted ? "bg-primary text-white" : "bg-white text-slate-200"
                                  )}>
                                     <perm.icon className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <div className={cn("text-base font-black tracking-tighter", isGranted ? "text-primary" : "text-slate-900")}>
                                      {perm.label}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">{perm.id}</div>
                                  </div>
                                </div>
                                <div className={cn(
                                  "w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner",
                                  isGranted ? "bg-primary" : "bg-slate-200"
                                )}>
                                  <div className={cn(
                                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm",
                                    isGranted ? "left-7" : "left-1"
                                  )} />
                                </div>
                              </button>
                            );
                          })}
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="p-8 space-y-4">
                   {searchTerm ? (
                     filteredUsers.length > 0 ? (
                       filteredUsers.map((user) => (
                         <button
                           key={user.uid}
                           onClick={() => {
                             setSelectedUser(user);
                             setSearchTerm('');
                           }}
                           className="w-full flex items-center justify-between p-6 rounded-[2.5rem] border-2 border-transparent bg-slate-50 hover:border-primary hover:bg-white transition-all duration-300 group shadow-sm hover:shadow-xl"
                         >
                           <div className="flex items-center gap-5 text-left">
                               <div className="w-14 h-14 bg-white rounded-[1.25rem] flex items-center justify-center font-black text-xl border-2 border-slate-100 text-slate-300 shadow-sm transition-all group-hover:bg-primary group-hover:text-white group-hover:border-primary group-hover:rotate-6">
                                 {user.displayName.charAt(0)}
                               </div>
                               <div className="flex flex-col text-left">
                                 <div className="flex items-center gap-2">
                                   <span className="font-black text-lg text-slate-900 tracking-tighter">{user.displayName}</span>
                                   <Badge className="bg-slate-200 text-slate-600 text-[9px] font-black border-none uppercase tracking-tighter px-2 py-0.5 rounded-lg">{user.role}</Badge>
                                 </div>
                                 <span className="text-[10px] font-bold text-slate-500 mt-0.5 tracking-tight">{user.employeeId} | {user.departmentName || '부서없음'}</span>
                               </div>
                           </div>
                           <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-primary transition-all group-hover:translate-x-1" />
                         </button>
                       ))
                     ) : (
                       <div className="py-24 text-center space-y-6 opacity-30">
                         <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto ring-8 ring-slate-50">
                            <Search className="w-10 h-10 text-slate-300" />
                         </div>
                         <p className="text-[13px] font-black text-slate-400 uppercase tracking-widest italic">일치하는 사용자가 없습니다</p>
                       </div>
                     )
                   ) : (
                     <div className="py-24 text-center space-y-6 opacity-30 animate-pulse">
                       <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto ring-8 ring-slate-50">
                          <Users className="w-10 h-10 text-slate-300" />
                       </div>
                       <div className="space-y-1">
                          <p className="text-[15px] font-black text-slate-400 uppercase tracking-widest leading-none">권한 관리 대상</p>
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mt-2">사용자를 검색하여 선택해주세요</p>
                       </div>
                     </div>
                   )}
                 </div>
               )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
