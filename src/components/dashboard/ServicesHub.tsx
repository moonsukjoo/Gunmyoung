import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  LayoutGrid,
  Folder,
  FolderOpen,
  Search,
  SlidersHorizontal,
  X
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
  isPrimary?: boolean; // Highlighted on main dashboard
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
  // 1. Field & Safety (현장·안전)
  {
    id: 'worklog',
    label: '작업일지',
    desc: '일일 조업 기록',
    path: '/personal-work-log',
    icon: ClipboardList,
    category: 'SAFETY_WORK',
    colorBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    isPrimary: true
  },
  {
    id: 'request',
    label: '안전요청',
    desc: '실시간 현장 요청',
    path: '/request-center',
    icon: MessageSquare,
    category: 'SAFETY_WORK',
    colorBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    iconColor: 'text-sky-600 dark:text-sky-400',
    isPrimary: true
  },
  {
    id: 'temp',
    label: '체감온도',
    desc: '온열질환 예방',
    path: '/perceived-temp',
    icon: Thermometer,
    category: 'SAFETY_WORK',
    colorBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    isPrimary: true
  },
  {
    id: 'health',
    label: '건강체크',
    desc: '일일 보건 보고',
    path: '/health-mgmt',
    icon: Activity,
    category: 'SAFETY_WORK',
    colorBg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    iconColor: 'text-red-600 dark:text-red-400'
  },
  {
    id: 'training',
    label: '안전교육',
    desc: '법정의무 교육',
    path: '/training-list',
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

  // 2. HR & Attendance (인사·근태)
  {
    id: 'attendance',
    label: '출퇴근',
    desc: '근태 실적 조회',
    path: '/attendance',
    icon: Clock,
    category: 'HR',
    colorBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    isPrimary: true
  },
  {
    id: 'settings',
    label: '근무설정',
    desc: '일과표 및 자동화',
    path: '/attendance/settings',
    icon: Settings2,
    category: 'HR',
    colorBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    badge: 'NEW',
    isPrimary: true
  },
  {
    id: 'leave',
    label: '연차신청',
    desc: '휴가 및 반차',
    path: '/leave',
    icon: CalendarDays,
    category: 'HR',
    colorBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    isPrimary: true
  },
  {
    id: 'payslip',
    label: '급여명세',
    desc: '명세서 열람',
    path: '/my-payslip',
    icon: Receipt,
    category: 'HR',
    colorBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    iconColor: 'text-teal-600 dark:text-teal-400'
  },

  // 3. Welfare & Culture (복지·소통)
  {
    id: 'meal',
    label: '식수신청',
    desc: '중식·석식 신청',
    path: '/meal-request',
    icon: Utensils,
    category: 'WELFARE',
    colorBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
    isPrimary: true
  },
  {
    id: 'praise',
    label: '칭찬하기',
    desc: '동료 감사 피드',
    path: '/praise-feed',
    icon: Heart,
    category: 'WELFARE',
    colorBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    iconColor: 'text-pink-600 dark:text-pink-400',
    isPrimary: true
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
    label: '선박게임',
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
    desc: '휴게소 엔터놀이',
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
  const [isAllServicesOpen, setIsAllServicesOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<'ALL' | 'SAFETY_WORK' | 'HR' | 'WELFARE'>('ALL');
  const [isExpandedOnDashboard, setIsExpandedOnDashboard] = useState(false);

  // Filtered list for the modal search / folder filter
  const modalFilteredServices = ALL_APP_SERVICES.filter(item => {
    const matchesFolder = selectedFolder === 'ALL' || item.category === selectedFolder;
    const matchesSearch = !searchKeyword.trim() || 
      item.label.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  // Displayed services on the main card: either top 8 essentials or all 17 when expanded
  const displayedServices = isExpandedOnDashboard 
    ? ALL_APP_SERVICES 
    : ALL_APP_SERVICES.filter(s => s.isPrimary);

  return (
    <section className="bg-card/70 backdrop-blur-md border border-border/70 rounded-3xl p-3 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-2.5">
      {/* Folder Header - Clean and Minimal */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <LayoutGrid className="w-3 h-3" />
          </div>
          <span className="text-xs font-black text-foreground tracking-tight whitespace-nowrap break-keep">
            바로가기
          </span>
        </div>

        {/* Action Button: Toggle / Open Full Folder Modal */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpandedOnDashboard(!isExpandedOnDashboard)}
            className="h-7 px-2 text-[11px] font-bold text-muted-foreground hover:text-foreground rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap break-keep"
          >
            {isExpandedOnDashboard ? (
              <>접기 <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>펼치기 <ChevronDown className="w-3 h-3" /></>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAllServicesOpen(true)}
            className="h-7 px-2.5 text-[11px] font-bold text-primary border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap break-keep shadow-2xs"
          >
            <FolderOpen className="w-3 h-3" />
            <span className="whitespace-nowrap">전체보기</span>
          </Button>
        </div>
      </div>

      {/* 📂 3-Category Folder Chips */}
      <div className="grid grid-cols-3 gap-1.5">
        {(['SAFETY_WORK', 'HR', 'WELFARE'] as const).map((catKey) => {
          const meta = CATEGORY_META[catKey];
          const count = ALL_APP_SERVICES.filter(s => s.category === catKey).length;
          return (
            <button
              key={catKey}
              type="button"
              onClick={() => {
                setSelectedFolder(catKey);
                setIsAllServicesOpen(true);
              }}
              className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-muted/40 border border-border/50 hover:border-primary/40 hover:bg-muted/70 transition-all cursor-pointer text-left group min-w-0"
            >
              <div className="flex items-center gap-1 min-w-0 shrink">
                <span className="text-xs shrink-0">{catKey === 'SAFETY_WORK' ? '🛠️' : catKey === 'HR' ? '📋' : '🎁'}</span>
                <span className="text-[11px] font-black text-foreground truncate whitespace-nowrap break-keep group-hover:text-primary transition-colors">
                  {meta.label}
                </span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground shrink-0 ml-1">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4-Column Clean Grid of Curated / Expanded Icons */}
      <div className="grid grid-cols-4 gap-2 sm:gap-2.5 pt-0.5">
        {displayedServices.map((service) => {
          const Icon = service.icon;
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => navigate(service.path)}
              className="group relative flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl bg-card border border-border/60 hover:border-primary/40 hover:bg-muted/40 active:scale-95 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs text-center overflow-hidden"
            >
              {service.badge && (
                <span className="absolute top-1 right-1 text-[8px] font-black bg-primary text-primary-foreground px-1 rounded-full leading-tight">
                  {service.badge}
                </span>
              )}
              <div className={cn(
                "w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border flex items-center justify-center mb-1 transition-all duration-300 group-hover:scale-110 shadow-xs shrink-0",
                service.colorBg
              )}>
                <Icon className={cn("w-5 h-5", service.iconColor)} />
              </div>
              <span className="text-[11.5px] font-black text-foreground group-hover:text-primary transition-colors whitespace-nowrap break-keep truncate max-w-full">
                {service.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Collapsed Indicator Footer */}
      {!isExpandedOnDashboard && (
        <button
          type="button"
          onClick={() => setIsAllServicesOpen(true)}
          className="w-full py-1.5 bg-muted/30 hover:bg-muted/60 border border-border/40 rounded-xl text-center text-[11px] font-bold text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap break-keep"
        >
          <span>더 많은 서비스 ({ALL_APP_SERVICES.length - displayedServices.length}개) 전체보기</span>
          <ChevronRight className="w-3 h-3 text-primary" />
        </button>
      )}

      {/* 🗂️ FULL SERVICE FOLDER MODAL / DRAWER (전체 서비스 폴더 서랍 모달) */}
      <Dialog open={isAllServicesOpen} onOpenChange={setIsAllServicesOpen}>
        <DialogContent className="max-w-md w-[95vw] p-5 rounded-3xl bg-background border-border/80 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
          <DialogHeader className="space-y-1.5 text-left shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-foreground">
                    전체 서비스 폴더 서랍
                  </DialogTitle>
                  <DialogDescription className="text-xs font-bold text-muted-foreground">
                    건명기업 사내 포털의 모든 기능을 카테고리별로 찾아보세요.
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Quick Search Box */}
            <div className="relative pt-2">
              <Search className="absolute left-3 top-5 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="서비스 이름 또는 설명 검색 (예: 연차, 식수, 온열)"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="h-10 pl-9 pr-8 bg-muted/50 rounded-xl text-xs font-bold border-border/60"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-3 top-5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Folder Tabs */}
            <div className="flex bg-muted/60 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar pt-1">
              {[
                { id: 'ALL', label: '전체 (17)' },
                { id: 'SAFETY_WORK', label: '🛠️ 현장·안전 (6)' },
                { id: 'HR', label: '📋 인사·근태 (4)' },
                { id: 'WELFARE', label: '🎁 복지·소통 (7)' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFolder(tab.id as any)}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap text-center cursor-pointer active:scale-95",
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

          {/* Folder Services List / Grid */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            {/* If Filter is ALL, show grouped by folders */}
            {selectedFolder === 'ALL' && !searchKeyword.trim() ? (
              (['SAFETY_WORK', 'HR', 'WELFARE'] as const).map((catKey) => {
                const meta = CATEGORY_META[catKey];
                const groupItems = ALL_APP_SERVICES.filter(s => s.category === catKey);

                return (
                  <div key={catKey} className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-xs">{catKey === 'SAFETY_WORK' ? '🛠️' : catKey === 'HR' ? '📋' : '🎁'}</span>
                      <h4 className="text-xs font-black text-foreground">{meta.fullLabel}</h4>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-border text-muted-foreground">
                        {groupItems.length}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {groupItems.map((service) => {
                        const Icon = service.icon;
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => {
                              setIsAllServicesOpen(false);
                              navigate(service.path);
                            }}
                            className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-card border border-border/60 hover:border-primary/50 hover:bg-muted/50 transition-all text-left cursor-pointer group shadow-2xs"
                          >
                            <div className={cn(
                              "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform",
                              service.colorBg
                            )}>
                              <Icon className={cn("w-4.5 h-4.5", service.iconColor)} />
                            </div>
                            <div className="truncate flex-1">
                              <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                                {service.label}
                              </p>
                              <p className="text-[10px] font-bold text-muted-foreground truncate">
                                {service.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {modalFilteredServices.map((service) => {
                  const Icon = service.icon;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setIsAllServicesOpen(false);
                        navigate(service.path);
                      }}
                      className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-card border border-border/60 hover:border-primary/50 hover:bg-muted/50 transition-all text-left cursor-pointer group shadow-2xs"
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform",
                        service.colorBg
                      )}>
                        <Icon className={cn("w-4.5 h-4.5", service.iconColor)} />
                      </div>
                      <div className="truncate flex-1">
                        <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition-colors">
                          {service.label}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground truncate">
                          {service.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {modalFilteredServices.length === 0 && (
                  <div className="col-span-2 py-12 text-center text-muted-foreground space-y-1">
                    <p className="text-xs font-black">검색 결과가 없습니다.</p>
                    <p className="text-[10px]">다른 검색어를 입력해 보세요.</p>
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
              className="w-full h-10 rounded-xl font-black text-xs"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
