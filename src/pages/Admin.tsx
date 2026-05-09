import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ClipboardList,
  Radio,
  FileBarChart,
  Activity,
  Target,
  Anchor
} from 'lucide-react';
import { db } from '@/src/firebase';
import { collection, query, onSnapshot, updateDoc, doc, setDoc, getDocs, where } from 'firebase/firestore';
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
  { id: 'health_mgmt', label: '보건관리(이상무) 보고 권한', icon: Activity },
  { id: 'report_mgmt', label: '통합 보고서 관리 권한', icon: FileBarChart },
];

import { GlowLoading } from '@/src/components/GlowLoading';

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const Admin: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isShipSettingsOpen, setIsShipSettingsOpen] = useState(false);
  const [isBannerSettingsOpen, setIsBannerSettingsOpen] = useState(false);
  const [isSnailSettingsOpen, setIsSnailSettingsOpen] = useState(false);
  const [isFishingSettingsOpen, setIsFishingSettingsOpen] = useState(false);
  const [isRouletteSettingsOpen, setIsRouletteSettingsOpen] = useState(false);
  const [isPermissionSettingsOpen, setIsPermissionSettingsOpen] = useState(false);
  const [isSafetySensorSettingsOpen, setIsSafetySensorSettingsOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'hr' | 'safety' | 'system'>('hr');

  const [snailProbs, setSnailProbs] = useState<number[]>([1, 1, 1]);
  const [fishingSettings, setFishingSettings] = useState([
    { id: 'small', name: '작은 물고기', multiplier: 2, probability: 0.5, icon: '🐟' },
    { id: 'medium', name: '큰 물고기', multiplier: 5, probability: 0.3, icon: '🐠' },
    { id: 'rare', name: '희귀 고기', multiplier: 20, probability: 0.15, icon: '🐡' },
    { id: 'boss', name: '보스 상어', multiplier: 100, probability: 0.04, icon: '🦈' },
    { id: 'legend', name: '황금 전설 고기', multiplier: 500, probability: 0.01, icon: '👑' }
  ]);
  const [rouletteProbs, setRouletteProbs] = useState<number[]>([0.35, 0.3, 0.2, 0.1, 0.03, 0.02]);

  const isExcludedRole = profile && (
    ['EMPLOYEE', 'TEAM_LEADER', 'WORKER'].includes(profile.role?.toUpperCase() || '') || 
    ['조장', '반장', '사원'].includes(profile.position?.trim() || '') ||
    profile.employeeId?.trim().toLowerCase().includes('x66626') ||
    profile.displayName?.toLowerCase().includes('x66626') ||
    profile.email?.toLowerCase().includes('x66626') ||
    user?.email?.toLowerCase().includes('x66626') ||
    user?.email?.split('@')[0]?.toLowerCase() === 'x66626' ||
    (user?.email && user.email.toLowerCase().startsWith('x66626@')) ||
    (user?.displayName && user.displayName.toLowerCase().includes('x66626'))
  );

  const [shipSettings, setShipSettings] = useState({
    probability: 0.3,
    disabledParts: [] as string[]
  });
  const [safetySensorSettings, setSafetySensorSettings] = useState({
    sensitivityLevel: 3, // Default moved to 3 for better robustness
    impactThreshold: 90.0,
    fallThreshold: 2.5,
    fallDuration: 250
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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'evacuation/status');
    });

    return () => unsubEvacuation();
  }, [profile]);

  useEffect(() => {
    if (evacuationStatus?.isActive) {
      const q = query(collection(db, 'evacuations', evacuationStatus.id, 'checkins'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setEvacuationCheckins(snapshot.docs.map(doc => doc.data()));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'evacuation_checkins');
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
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const unsubBanner = onSnapshot(doc(db, 'settings', 'banner'), (snapshot) => {
      if (snapshot.exists()) {
        setBannerText(snapshot.data().text || '안전한 하루가 되세요');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/banner');
    });

    const unsubSnail = onSnapshot(doc(db, 'settings', 'entertainment'), (snap) => {
       if (snap.exists()) {
          const data = snap.data();
          setSnailProbs(data.snailProbabilities || [1, 1, 1]);
          if (data.fishingSettings) {
            setFishingSettings(data.fishingSettings);
          } else if (data.fishingProbabilities) {
            // Migration: convert old array to new structure
            const migrated = [...fishingSettings];
            data.fishingProbabilities.forEach((p: number, i: number) => {
              if (migrated[i]) migrated[i].probability = p;
            });
            setFishingSettings(migrated);
          }
          setRouletteProbs(data.rouletteProbabilities || [0.35, 0.3, 0.2, 0.1, 0.03, 0.02]);
       }
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, 'settings/entertainment');
    });

    const unsubSafetySensors = onSnapshot(doc(db, 'settings', 'safety_sensors'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSafetySensorSettings({
          sensitivityLevel: data.sensitivityLevel || 2,
          impactThreshold: data.impactThreshold || 40.0,
          fallThreshold: data.fallThreshold || 3.0,
          fallDuration: data.fallDuration || 150
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/safety_sensors');
    });

    return () => {
      unsubBanner();
      unsubSnail();
      unsubSafetySensors();
    };
  }, [profile]);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      { to: '/personnel', label: '인사등록', icon: UserPlus, permission: 'employee_mgmt', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
      { to: '/attendance-mgmt', label: '근태 관리', icon: Clock, permission: 'attendance_mgmt', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
      { to: '/leave-mgmt', label: '연차/휴가 관리', icon: CalendarDays, permission: 'leave_mgmt', color: 'text-sky-400', bgColor: 'bg-sky-500/20' },
      { to: '/payslip-mgmt', label: '급여명세서 관리', icon: CircleDollarSign, permission: 'payslip_mgmt', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
      { to: '/work-log-mgmt', label: '작업일지 관리', icon: ClipboardList, permission: 'work_log_mgmt', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
      { to: '/qualification', label: '자격/교육이력 관리', icon: ClipboardList, permission: 'qualification_mgmt', color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
      { to: '/redemption-mgmt', label: '현물 신청 관리', icon: CircleDollarSign, permission: 'redemption_mgmt', color: 'text-green-400', bgColor: 'bg-green-500/20' },
      { to: '/admin/reports', label: '통합 보고서 관리', icon: FileBarChart, permission: 'admin', color: 'text-blue-300', bgColor: 'bg-blue-500/20' },
    ],
    safety: [
      { onClick: () => navigate('/high-work-monitor'), label: '고소작업 현황', icon: BarChart3, permission: 'high_work_monitor', color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
      { onClick: () => setIsEmergencyOpen(true), label: '비상 대피 (롤콜)', icon: AlertTriangle, permission: 'emergency_rollcall', color: 'text-red-400', bgColor: 'bg-red-500/20' },
      { to: '/accidents', label: '사고즉보 관리', icon: ShieldAlert, permission: 'accident_mgmt', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
      { to: '/health-mgmt', label: '보건관리 보고', icon: Activity, permission: 'health_mgmt', color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
      { to: '/enclosed-monitoring', label: '밀폐공간 관제', icon: Radio, permission: 'admin', color: 'text-rose-300', bgColor: 'bg-rose-500/20' },
      { to: '/training-mgmt', label: '교육/평가 관리', icon: HardHat, permission: 'training_mgmt', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
      { to: '/safety-score', label: '안전지수 설정', icon: ShieldCheck, permission: 'safety_score_admin', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
    ],
    system: [
      { to: '/admin/pc-dashboard', label: 'PC 대시보드', icon: LayoutDashboard, permission: 'admin', newTab: true, color: 'text-slate-300', bgColor: 'bg-slate-500/30' },
      { to: '/notifications', label: '공지사항 관리', icon: Megaphone, permission: 'notice_mgmt', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
      { onClick: () => setIsBannerSettingsOpen(true), label: '배너 문구 설정', icon: Megaphone, permission: 'admin', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
      { to: '/coupons', label: '포상/룰렛 관리', icon: Trophy, permission: 'praise_coupon', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
      { onClick: () => setIsSnailSettingsOpen(true), label: '건명 달팽이 확률 설정', icon: Radio, permission: 'admin', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
      { onClick: () => setIsFishingSettingsOpen(true), label: '건명 낚시 확률 설정', icon: Anchor, permission: 'admin', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
      { onClick: () => setIsRouletteSettingsOpen(true), label: '건명 룰렛 확률 설정', icon: Target, permission: 'admin', color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
      { onClick: () => setIsSafetySensorSettingsOpen(true), label: '충격 감지 감도 설정', icon: ShieldAlert, permission: 'admin', color: 'text-red-400', bgColor: 'bg-red-500/20' },
      { onClick: () => setIsShipSettingsOpen(true), label: '함선 파츠 확률', icon: Ship, permission: 'admin', color: 'text-blue-300', bgColor: 'bg-blue-500/20' },
      { onClick: () => setIsPermissionSettingsOpen(true), label: '사용자 권한 관리', icon: ShieldCheck, permission: 'admin', color: 'text-slate-300', bgColor: 'bg-slate-500/20' },
    ]
  };

  const renderLink = (link: any, idx: number) => {
    if (isExcludedRole) {
      // Specifically hide these as requested if they are in the excluded roles
      if (link.label === '공지사항 관리' || link.label === '사고즉보 관리' || link.label === '나의 안전지수/랭킹 조회') {
        return null;
      }
    }

    const isAllowed = isAdminMode || 
      (link.roles && profile && link.roles.includes(profile.role)) ||
      (link.permission && profile && profile.permissions?.includes(link.permission));

    if (!isAllowed) return null;

    const Content = (
      <div className="bg-white/[0.03] p-4 rounded-3xl border border-white/5 flex items-center gap-4 active:scale-95 transition-all w-full text-left hover:bg-white/[0.06] hover:border-white/10 group shadow-lg shadow-black/20">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", link.bgColor || "bg-primary/10")}>
          <link.icon className={cn("w-6 h-6", link.color || "text-primary")} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-black text-white leading-tight truncate">{link.label}</span>
        </div>
        <div className="ml-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-white/60 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
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

  if (loading) return <GlowLoading message="관리자 시스템" subMessage="접속 권한 확인 중..." />;

  const isAdminMode = profile && !isExcludedRole && (
    profile.role === 'CEO' || 
    profile.permissions?.includes('admin') ||
    profile.email === 'tjrwnfjqm1@gmail.com'
  );

  return (
    <div className="space-y-8 pb-24 px-1">
      <header className="py-6">
        <h2 className="text-3xl font-black tracking-tight text-white leading-tight">관리자 시스템</h2>
        <p className="text-muted-foreground font-bold">건명기업 시스템의 코어 설정을 제어합니다</p>
      </header>

      {/* Category Tabs - Grid for fixed size */}
      <div className="grid grid-cols-3 gap-1 bg-white/5 p-1.5 rounded-3xl border border-white/5 mx-1">
        {[
          { id: 'hr', label: '인사/기획', icon: Users, color: 'text-blue-500' },
          { id: 'safety', label: '안전/관제', icon: HardHat, color: 'text-rose-500' },
          { id: 'system', label: '시스템/보상', icon: Settings, color: 'text-amber-500' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={cn(
              "flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3.5 rounded-2xl transition-all duration-500",
              activeCategory === tab.id 
                ? "bg-white/10 text-white shadow-2xl shadow-black/40 scale-[1.02] border border-white/10" 
                : "text-white/30 hover:text-white/60"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeCategory === tab.id ? tab.color : "text-white/20")} />
            <span className="text-[11px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Menus Content */}
      <motion.div 
        key={activeCategory}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="space-y-4 px-1"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categorizedLinks[activeCategory].map((link, idx) => renderLink(link, idx))}
        </div>
      </motion.div>

      <Dialog open={isSafetySensorSettingsOpen} onOpenChange={setIsSafetySensorSettingsOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-sm p-6 overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">긴급 충격 감지 감도 설정</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground">
              추락 및 강한 충격 감지 기준을 설정합니다. (1단계: 매우 예민, 5단계: 매우 둔감)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 border-y border-white/5 my-4">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <Label className="text-[10px] font-black text-primary uppercase tracking-widest">감도 단계</Label>
                <span className="text-xl font-black text-white">{safetySensorSettings.sensitivityLevel}단계</span>
              </div>
              
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      // Define thresholds for each level
                      // User requested specific logic:
                      // Level 1: 1m fall / impact (Sensitive)
                      // Level 2: 2.5m fall / impact
                      const thresholds = [
                        { impact: 35.0, fall: 3.5, duration: 120 }, // 1단계: 1m 추락 및 일상 충격 (매우 예민)
                        { impact: 65.0, fall: 3.0, duration: 180 }, // 2단계: 2.5m 추락 및 강한 충격 (민감)
                        { impact: 90.0, fall: 2.5, duration: 250 }, // 3단계: 고소 추락 및 심각한 충격 (보통)
                        { impact: 130.0, fall: 2.0, duration: 350 }, // 4단계: 기계적 충격 (둔감)
                        { impact: 180.0, fall: 1.5, duration: 500 }  // 5단계: 측정 한계 수준 (매우 둔감)
                      ];
                      const selected = thresholds[level - 1];
                      setSafetySensorSettings({
                        sensitivityLevel: level,
                        impactThreshold: selected.impact,
                        fallThreshold: selected.fall,
                        fallDuration: selected.duration
                      });
                    }}
                    className={cn(
                      "h-12 rounded-xl text-sm font-black transition-all",
                      safetySensorSettings.sensitivityLevel === level
                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                        : "bg-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="p-4 bg-white/5 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-black text-muted-foreground uppercase">관리 기준 (시뮬레이션)</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-white">
                    {safetySensorSettings.sensitivityLevel === 1 && "1단계: 약 1미터 높이에서의 추락이나 일상적인 부딪힘"}
                    {safetySensorSettings.sensitivityLevel === 2 && "2단계: 약 2.5미터 높이에서의 추락이나 상당히 강한 충격"}
                    {safetySensorSettings.sensitivityLevel === 3 && "3단계: 고소 작업 중 추락이나 장비 충돌 수준의 충격"}
                    {safetySensorSettings.sensitivityLevel === 4 && "4단계: 매우 강한 기계적 충격 또는 사고 상황"}
                    {safetySensorSettings.sensitivityLevel === 5 && "5단계: 차량 전복이나 극심한 파손 상황 전용 (가장 낮음)"}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic">
                    * 설정값: 충격 가속도 {safetySensorSettings.impactThreshold.toFixed(1)}m/s², 추락 판정 {safetySensorSettings.fallDuration}ms
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[10px] font-bold text-red-400 text-center italic">
              * 설정 시 모든 사용자의 충격 감지 기준이 실시간으로 변경됩니다.
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl border-white/10 text-white font-black"
              onClick={() => setIsSafetySensorSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-12 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'safety_sensors'), {
                    ...safetySensorSettings,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('충격 감지 감도 설정이 저장되었습니다.');
                  setIsSafetySensorSettingsOpen(false);
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

      <Dialog open={isFishingSettingsOpen} onOpenChange={setIsFishingSettingsOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-sm p-6 overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">건명 낚시 (OVERHAUL) 설정</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground">
              물고기 종류별 이름, 배당률(Multiplier), 출현 확률을 관리합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 border-y border-white/5 my-4 overflow-y-auto max-h-[60vh]">
            {fishingSettings.map((fish, index) => (
              <div key={fish.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                       <span className="text-xl">{fish.icon}</span>
                       <Input 
                         value={fish.name} 
                         onChange={(e) => {
                           const updated = [...fishingSettings];
                           updated[index].name = e.target.value;
                           setFishingSettings(updated);
                         }}
                         className="h-8 bg-transparent border-none font-black text-sm p-0 w-32 focus-visible:ring-0"
                       />
                    </div>
                    <div className="flex items-center gap-1">
                       <span className="text-[10px] font-black text-muted-foreground">배당</span>
                       <Input 
                         type="number" 
                         value={fish.multiplier}
                         onChange={(e) => {
                           const updated = [...fishingSettings];
                           updated[index].multiplier = parseFloat(e.target.value) || 0;
                           setFishingSettings(updated);
                         }}
                         className="h-8 w-16 bg-white/5 border-none font-black text-right text-emerald-400"
                       />
                       <span className="text-[10px] font-black">x</span>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                       <span className="text-primary">확률</span>
                       <span>{(fish.probability * 100).toFixed(1)}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={fish.probability}
                      onChange={(e) => {
                        const updated = [...fishingSettings];
                        updated[index].probability = parseFloat(e.target.value);
                        setFishingSettings(updated);
                      }}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-primary"
                    />
                 </div>
              </div>
            ))}

            <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl">
               <p className="text-[10px] font-black text-primary text-center uppercase">
                  확률 합계: {fishingSettings.reduce((a, b) => a + b.probability, 0).toFixed(2)} (1.0 권장)
               </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl border-white/10 text-white font-black"
              onClick={() => setIsFishingSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-12 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'entertainment'), { 
                    fishingSettings: fishingSettings,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('낚시 설정이 전역 저장되었습니다.');
                  setIsFishingSettingsOpen(false);
                } catch (e) {
                  toast.error('설정 저장 중 오류가 발생했습니다.');
                }
              }}
            >
              전역 적용
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRouletteSettingsOpen} onOpenChange={setIsRouletteSettingsOpen}>
        <DialogContent className="bg-card border-none rounded-3xl text-white max-w-sm p-6 overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">건명 룰렛 확률 설정</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground">
              룰렛 각 칸의 당첨 확률을 실시간으로 조절합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 border-y border-white/5 my-4 overflow-y-auto max-h-[60vh]">
            {[
              { label: '꽝 (0배)', index: 0 },
              { label: '1배 당첨', index: 1 },
              { label: '2배 당첨', index: 2 },
              { label: '꽝 (0배) [2]', index: 3 },
              { label: '5배 당첨', index: 4 },
              { label: '10배 당첨', index: 5 }
            ].map((item) => (
              <div key={item.index} className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black text-rose-400 uppercase">
                   <span>{item.label}</span>
                   <span>{(rouletteProbs[item.index] * 100).toFixed(1)}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={rouletteProbs[item.index]}
                  onChange={(e) => {
                    const updated = [...rouletteProbs];
                    updated[item.index] = parseFloat(e.target.value);
                    setRouletteProbs(updated);
                  }}
                  className="w-full accent-rose-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
               <p className="text-[10px] font-black text-emerald-400 text-center uppercase">
                  확률 합계: {rouletteProbs.reduce((a, b) => a + b, 0).toFixed(2)} (1.0 권장)
               </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl border-white/10 text-white font-black"
              onClick={() => setIsRouletteSettingsOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-12 bg-rose-500 text-white font-black rounded-2xl shadow-lg shadow-rose-500/20"
              onClick={async () => {
                try {
                  await setDoc(doc(db, 'settings', 'entertainment'), { 
                    rouletteProbabilities: rouletteProbs,
                    updatedAt: new Date().toISOString(),
                    updatedBy: profile?.uid
                  }, { merge: true });
                  toast.success('룰렛 확률 설정이 저장되었습니다.');
                  setIsRouletteSettingsOpen(false);
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
           <DialogHeader><DialogTitle className="font-black text-xl">달팽이 레이스 확률</DialogTitle></DialogHeader>
           <div className="space-y-4 py-4">
              {snailProbs.map((p, i) => (
                <div key={i} className="flex flex-col gap-2 p-4 bg-white/5 rounded-2xl border border-white/5">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground">
                      <span>{i+1}번 달팽이 (스피드 계수)</span>
                      <span className="text-primary">{p.toFixed(1)}x</span>
                   </div>
                   <input 
                     type="range" 
                     min="0.5" 
                     max="3" 
                     step="0.1" 
                     value={p} 
                     onChange={e => {
                        const updated = [...snailProbs]; 
                        updated[i] = parseFloat(e.target.value); 
                        setSnailProbs(updated);
                     }} 
                     className="w-full h-2 bg-white/10 rounded-full appearance-none accent-primary" 
                   />
                </div>
              ))}
              <p className="text-[10px] font-bold text-muted-foreground text-center italic">
                * 계수가 높을수록 해당 달팽이가 승리할 확률이 높아집니다.
              </p>
           </div>
           <Button className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20" onClick={async () => {
             try {
               await setDoc(doc(db, 'settings', 'entertainment'), { 
                 snailProbabilities: snailProbs,
                 updatedAt: new Date().toISOString(),
                 updatedBy: profile?.uid
               }, { merge: true });
               toast.success('달팽이 확률 설정이 저장되었습니다.'); 
               setIsSnailSettingsOpen(false);
             } catch (e) {
               toast.error('저장 중 오류가 발생했습니다.');
             }
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
                  <DialogTitle className="font-black text-xl">비상 대피 실시간 인원 파악</DialogTitle>
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
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">출근 인원 대비</p>
                    <div className="relative">
                      <p className="text-4xl font-black text-blue-500">{evacuationCheckins.length}</p>
                      <p className="text-[10px] font-bold text-blue-500/40 absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        / {evacuationStatus.totalClockedIn || '-'} 명
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">전체 인원 대비</p>
                    <div className="relative">
                      <p className="text-4xl font-black text-emerald-500">{evacuationCheckins.length}</p>
                      <p className="text-[10px] font-bold text-emerald-500/40 absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        / {evacuationStatus.totalWorkers || users.length} 명
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <p className="text-[10px] font-black text-red-600/60 uppercase tracking-widest px-1">미확인 인원: {Math.max(0, (evacuationStatus.totalWorkers || users.length) - evacuationCheckins.length)}명</p>
                  {/* Progress Bar */}
                  <div className="bg-white/5 h-4 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(evacuationCheckins.length / (evacuationStatus.totalWorkers || users.length)) * 100}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
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
                        const now = new Date().toISOString();
                        const endedBy = profile?.displayName || user?.displayName || user?.email || 'Admin';
                        
                        await setDoc(doc(db, 'evacuation', 'status'), { 
                          isActive: false,
                          endedAt: now,
                          endedBy: endedBy
                        }, { merge: true });

                        if (evacuationStatus?.id) {
                          await setDoc(doc(db, 'evacuations', evacuationStatus.id), {
                            isActive: false,
                            status: 'FINISHED',
                            finishedAt: now,
                            endedAt: now,
                            endedBy: endedBy,
                            confirmedCount: evacuationCheckins.length
                          }, { merge: true });
                        }
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
                <div className="flex justify-between items-center px-1">
                  <p className="text-sm font-black text-white">최근 대피 이력</p>
                  <Button 
                    variant="ghost" 
                    className="text-xs text-primary font-black p-0 h-auto"
                    onClick={() => navigate('/admin/evacuation-history')}
                  >
                   전체 보기 <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>

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
                    const now = new Date().toISOString();
                    
                    // Count clocked in workers
                    const today = new Date().toISOString().split('T')[0];
                    const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', today)));
                    const clockedInCount = attSnap.docs.filter(doc => !doc.data().clockOut).length;

                    const evData = {
                      id,
                      isActive: true,
                      activatedAt: now,
                      activatedByUid: profile?.uid,
                      activatedByName: profile?.displayName,
                      reason,
                      totalWorkers: users.length,
                      totalClockedIn: clockedInCount || users.length, // Fallback to total if 0
                      confirmedCount: 0
                    };

                    await setDoc(doc(db, 'evacuation', 'status'), evData);
                    await setDoc(doc(db, 'evacuations', id), {
                      ...evData,
                      status: 'ACTIVE'
                    });
                    
                    toast.error('비상 대피령이 발동되었습니다!');
                  }}
                >
                  비상 대피령 발동 (인원 파악 시작)
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
