import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import {
  ClipboardList,
  MessageSquare,
  Thermometer,
  Activity,
  BookOpen,
  Trophy,
  Clock,
  CalendarDays,
  Receipt,
  Utensils,
  Heart,
  Ticket,
  Sparkles,
  Ship,
  Sparkle,
  FileBox,
  Settings2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Search,
  X,
  AlertTriangle,
  Megaphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { getService3DIcon, getServiceSoftBedClass } from '@/components/icons/Marine3DIcons';

export interface ServiceItem {
  id: string;
  label: string;
  desc: string;
  path: string;
  icon: React.ElementType;
  category: 'SAFETY_WORK' | 'HR' | 'WELFARE';
  colorBg: string;
  iconColor: string;
  badge?: string;
  isPrimary?: boolean;
}

export const CATEGORY_META = {
  SAFETY_WORK: {
    id: 'SAFETY_WORK',
    label: '현장·안전',
    fullLabel: '현장 조업 & 안전 관리',
    icon: ClipboardList,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    desc: '작업일지, 안전요청, 보건, 교육'
  },
  HR: {
    id: 'HR',
    label: '인사·근태',
    fullLabel: '인사·근태 & 급여 센터',
    icon: Clock,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10 border-blue-500/20',
    desc: '출퇴근, 근무시간설정, 연차, 급여명세'
  },
  WELFARE: {
    id: 'WELFARE',
    label: '복지·소통',
    fullLabel: '복지·동료칭찬 & 엔터테인먼트',
    icon: Sparkles,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10 border-purple-500/20',
    desc: '식수신청, 칭찬피드, 쿠폰, 미니게임'
  }
} as const;

export const ALL_APP_SERVICES: ServiceItem[] = [
  // Primary 6 curated 3D Launcher items first
  {
    id: 'meal',
    label: '식수 신청',
    desc: '중식 · 석식',
    path: '/meal-request',
    icon: Utensils,
    category: 'WELFARE',
    colorBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
    isPrimary: true
  },
  {
    id: 'request',
    label: '안전·자재',
    desc: '현장 요청',
    path: '/request-center',
    icon: MessageSquare,
    category: 'SAFETY_WORK',
    colorBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    isPrimary: true
  },
  {
    id: 'payslip',
    label: '급여명세',
    desc: '명세서 열람',
    path: '/mypage/payslip',
    icon: Receipt,
    category: 'HR',
    colorBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    isPrimary: true
  },
  {
    id: 'leave',
    label: '연차·휴가',
    desc: '휴가 신청',
    path: '/leave',
    icon: CalendarDays,
    category: 'HR',
    colorBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    isPrimary: true
  },
  {
    id: 'health',
    label: '건강체크',
    desc: '일일 보건',
    path: '/health-mgmt',
    icon: Activity,
    category: 'SAFETY_WORK',
    colorBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    iconColor: 'text-sky-600 dark:text-sky-400',
    isPrimary: true
  },
  {
    id: 'notices',
    label: '전체 공지',
    desc: '사내 공지사항',
    path: '/notices',
    icon: Megaphone,
    category: 'WELFARE',
    colorBg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    isPrimary: true
  },

  // Additional categorized services
  {
    id: 'worklog',
    label: '작업일지',
    desc: '일일 조업 기록',
    path: '/personal-work-log',
    icon: ClipboardList,
    category: 'SAFETY_WORK',
    colorBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'accidents',
    label: '안전사고 사례',
    desc: '아차사고 · 예방',
    path: '/accidents',
    icon: AlertTriangle,
    category: 'SAFETY_WORK',
    colorBg: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    iconColor: 'text-rose-600'
  },
  {
    id: 'temp',
    label: '체감온도',
    desc: '온열질환 예방',
    path: '/perceived-temp',
    icon: Thermometer,
    category: 'SAFETY_WORK',
    colorBg: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    iconColor: 'text-rose-600'
  },
  {
    id: 'training',
    label: '안전교육',
    desc: '법정의무 교육',
    path: '/training',
    icon: BookOpen,
    category: 'SAFETY_WORK',
    colorBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    iconColor: 'text-purple-600 dark:text-purple-400'
  },
  {
    id: 'ranking',
    label: '안전랭킹',
    desc: '우수 요원 순위',
    path: '/safety-leaderboard',
    icon: Trophy,
    category: 'SAFETY_WORK',
    colorBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400'
  },
  {
    id: 'attendance',
    label: '출퇴근 기록',
    desc: '근태 실적 조회',
    path: '/attendance',
    icon: Clock,
    category: 'HR',
    colorBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'settings',
    label: '근무설정',
    desc: '일과표 · 자동화',
    path: '/attendance/settings',
    icon: Settings2,
    category: 'HR',
    colorBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    badge: '관리'
  },
  {
    id: 'praise',
    label: '칭찬하기',
    desc: '동료 감사 피드',
    path: '/praise-feed',
    icon: Heart,
    category: 'WELFARE',
    colorBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    iconColor: 'text-pink-600 dark:text-pink-400'
  },
  {
    id: 'coupons',
    label: '복지쿠폰',
    desc: '모바일 쿠폰함',
    path: '/coupons',
    icon: Ticket,
    category: 'WELFARE',
    colorBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    iconColor: 'text-purple-600 dark:text-purple-400'
  },
  {
    id: 'redemption',
    label: '현물보상',
    desc: '포인트 교환몰',
    path: '/redemption',
    icon: Sparkles,
    category: 'WELFARE',
    colorBg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    iconColor: 'text-yellow-600 dark:text-yellow-400'
  },
  {
    id: 'ship',
    label: '선박조립',
    desc: '출근 보상 퍼즐',
    path: '/ship-assembly',
    icon: Ship,
    category: 'WELFARE',
    colorBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    iconColor: 'text-sky-600 dark:text-sky-400'
  },
  {
    id: 'lotto',
    label: '행운로또',
    desc: '주간 번호 추첨',
    path: '/lotto',
    icon: Sparkle,
    category: 'WELFARE',
    colorBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400'
  },
  {
    id: 'entertainment',
    label: '미니게임',
    desc: '휴게 엔터놀이',
    path: '/entertainment',
    icon: FileBox,
    category: 'WELFARE',
    colorBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400'
  }
];

interface ServicesHubProps {
  activeCategory?: 'ALL' | 'SAFETY_WORK' | 'HR' | 'WELFARE';
  setActiveCategory?: (cat: 'ALL' | 'SAFETY_WORK' | 'HR' | 'WELFARE') => void;
}

export const ServicesHub: React.FC<ServicesHubProps> = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isLight = profile?.lightTheme !== false && !profile?.highContrast;
  const isCEO = profile?.role === 'CEO' || profile?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';
  const [isAllServicesOpen, setIsAllServicesOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<'ALL' | 'SAFETY_WORK' | 'HR' | 'WELFARE'>('ALL');
  const [isExpandedOnDashboard, setIsExpandedOnDashboard] = useState(false);

  const visibleServices = ALL_APP_SERVICES.filter(item => item.id !== 'settings' || isCEO);

  const modalFilteredServices = visibleServices.filter(item => {
    const matchesFolder = selectedFolder === 'ALL' || item.category === selectedFolder;
    const matchesSearch = !searchKeyword.trim() ||
      item.label.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const displayedServices = isExpandedOnDashboard
    ? visibleServices
    : visibleServices.filter(s => s.isPrimary);

  return (
    <section className="space-y-3 pt-1">
      {/* Borderless 3-Column Extruded 3D Clay Icon Launcher */}
      <div className="grid grid-cols-3 gap-y-4 gap-x-3">
        {displayedServices.map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => navigate(service.path)}
            className="group relative flex flex-col items-center text-center cursor-pointer active:scale-95 transition-transform"
          >
            <div
              className={cn(
                "w-[68px] h-[68px] rounded-[24px] flex items-center justify-center shadow-[0_8px_20px_rgba(15,23,42,0.06)] group-hover:-translate-y-1 transition-transform duration-200 relative",
                isLight ? "border border-white/80" : "border border-white/10",
                getServiceSoftBedClass(service.id, isLight)
              )}
            >
              {getService3DIcon(service.id, 'w-11 h-11')}
              {service.badge && (
                <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shadow-xs">
                  {service.badge}
                </span>
              )}
            </div>
            <span className="text-[13px] font-black text-foreground mt-2 leading-tight group-hover:text-primary transition-colors">
              {service.label}
            </span>
            <span className="text-[10.5px] font-bold text-muted-foreground mt-0.5 leading-tight">
              {service.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Discrete Compact Expand / Full Menu Strip */}
      <div className="flex items-center justify-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => setIsExpandedOnDashboard(!isExpandedOnDashboard)}
          className="h-7 px-3 rounded-full text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-1 cursor-pointer transition-colors"
        >
          {isExpandedOnDashboard ? (
            <>주요 6개만 보기 <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>전체 메뉴 ({visibleServices.length}) <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedFolder('ALL');
            setIsAllServicesOpen(true);
          }}
          className="h-7 px-3 rounded-full text-[11px] font-black text-primary bg-primary/8 hover:bg-primary/15 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <FolderOpen className="w-3 h-3" />
          <span>분야별 찾기 · 사고사례 · 칭찬</span>
        </button>
      </div>

      {/* 3-Group Organized All-Services Modal Drawer */}
      <Dialog open={isAllServicesOpen} onOpenChange={setIsAllServicesOpen}>
        <DialogContent className="max-w-md w-[95vw] p-5 rounded-[30px] bg-card border-border/80 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden text-foreground">
          <DialogHeader className="space-y-2 text-left shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  건명기업 전체 메뉴
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground">
                  현장 · 근태 · 복지 기능을 3개 폴더로 정리했습니다.
                </DialogDescription>
              </div>
            </div>

            <div className="relative pt-1">
              <Search className="absolute left-3.5 top-4.5 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="메뉴 이름 검색 (예: 급여, 연차, 식수)"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="h-10 pl-9 pr-8 bg-muted/60 rounded-2xl text-xs font-bold border-border/60"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-3 top-4.5 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex bg-muted/60 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: `전체 (${visibleServices.length})` },
                { id: 'SAFETY_WORK', label: '현장·안전' },
                { id: 'HR', label: '인사·근태' },
                { id: 'WELFARE', label: '복지·소통' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFolder(tab.id as any)}
                  className={cn(
                    "flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center cursor-pointer",
                    selectedFolder === tab.id
                      ? "bg-card text-foreground shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            {selectedFolder === 'ALL' && !searchKeyword.trim() ? (
              (['SAFETY_WORK', 'HR', 'WELFARE'] as const).map((catKey) => {
                const meta = CATEGORY_META[catKey];
                const groupItems = visibleServices.filter(s => s.category === catKey);

                return (
                  <div key={catKey} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-black text-foreground">{meta.fullLabel}</h4>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                        {groupItems.length}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {groupItems.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => {
                            setIsAllServicesOpen(false);
                            navigate(service.path);
                          }}
                          className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border/50 transition-all text-left cursor-pointer group"
                        >
                          <div className={cn(
                            "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                            getServiceSoftBedClass(service.id, isLight)
                          )}>
                            {getService3DIcon(service.id, 'w-7 h-7')}
                          </div>
                          <div className="truncate flex-1">
                            <p className="text-xs font-black text-foreground truncate group-hover:text-primary">
                              {service.label}
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground truncate">
                              {service.desc}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {modalFilteredServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      setIsAllServicesOpen(false);
                      navigate(service.path);
                    }}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border/50 transition-all text-left cursor-pointer group"
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                      getServiceSoftBedClass(service.id, isLight)
                    )}>
                      {getService3DIcon(service.id, 'w-7 h-7')}
                    </div>
                    <div className="truncate flex-1">
                      <p className="text-xs font-black text-foreground truncate group-hover:text-primary">
                        {service.label}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground truncate">
                        {service.desc}
                      </p>
                    </div>
                  </button>
                ))}
                {modalFilteredServices.length === 0 && (
                  <div className="col-span-2 py-12 text-center text-muted-foreground space-y-1">
                    <p className="text-xs font-black">검색 결과가 없습니다.</p>
                    <p className="text-[11px]">다른 검색어를 입력해 보세요.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border/40 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAllServicesOpen(false)}
              className="w-full h-11 rounded-2xl font-black text-xs cursor-pointer"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
