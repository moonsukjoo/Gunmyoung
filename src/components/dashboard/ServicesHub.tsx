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
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
}

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
    iconColor: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    id: 'request',
    label: '업무/안전요청',
    desc: '실시간 현장 요청',
    path: '/request-center',
    icon: MessageSquare,
    category: 'SAFETY_WORK',
    colorBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    iconColor: 'text-sky-600 dark:text-sky-400'
  },
  {
    id: 'temp',
    label: '체감온도',
    desc: '온열질환 예방',
    path: '/perceived-temp',
    icon: Thermometer,
    category: 'SAFETY_WORK',
    colorBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400'
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
    label: '출퇴근현황',
    desc: '근태 실적 조회',
    path: '/attendance',
    icon: Clock,
    category: 'HR',
    colorBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'settings',
    label: '근무시간설정',
    desc: '일과표 및 자동화',
    path: '/attendance/settings',
    icon: Settings2,
    category: 'HR',
    colorBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    badge: 'NEW'
  },
  {
    id: 'leave',
    label: '연차신청',
    desc: '휴가 및 반차',
    path: '/leave',
    icon: CalendarDays,
    category: 'HR',
    colorBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    iconColor: 'text-indigo-600 dark:text-indigo-400'
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
    iconColor: 'text-orange-600 dark:text-orange-400'
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
    label: '엔터놀이',
    desc: '휴게소 미니게임',
    path: '/entertainment',
    icon: FileBox,
    category: 'WELFARE',
    colorBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400'
  }
];

interface ServicesHubProps {
  activeCategory: 'ALL' | 'SAFETY_WORK' | 'HR' | 'WELFARE';
  setActiveCategory: (cat: 'ALL' | 'SAFETY_WORK' | 'HR' | 'WELFARE') => void;
}

export const ServicesHub: React.FC<ServicesHubProps> = ({
  activeCategory,
  setActiveCategory
}) => {
  const navigate = useNavigate();

  const filteredServices = ALL_APP_SERVICES.filter(item => {
    if (activeCategory === 'ALL') return true;
    return item.category === activeCategory;
  });

  return (
    <section className="bg-card/70 backdrop-blur-md border border-border/70 rounded-3xl p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-3">
      {/* Category Pills Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <LayoutGrid className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-black text-foreground tracking-tight">
            업무 및 편의 서비스
          </h3>
          <Badge variant="outline" className="text-[9.5px] px-1.5 py-0 font-bold border-border text-muted-foreground">
            {filteredServices.length}개
          </Badge>
        </div>
      </div>

      {/* Segmented Category Filter Tabs */}
      <div className="flex bg-muted/50 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'ALL', label: '전체' },
          { id: 'SAFETY_WORK', label: '🛠️ 현장·안전' },
          { id: 'HR', label: '📋 인사·근태' },
          { id: 'WELFARE', label: '🎁 복지·소통' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveCategory(tab.id as any)}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center cursor-pointer active:scale-95",
              activeCategory === tab.id
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4-Column Modern Clean Icon Launcher */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-1">
        {filteredServices.map((service) => {
          const Icon = service.icon;
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => navigate(service.path)}
              className="group relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-card border border-border/60 hover:border-primary/40 hover:bg-muted/40 active:scale-95 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs text-center"
            >
              {service.badge && (
                <span className="absolute top-1.5 right-1.5 text-[8.5px] font-black bg-primary text-primary-foreground px-1 rounded-full leading-tight">
                  {service.badge}
                </span>
              )}
              <div className={cn(
                "w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border flex items-center justify-center mb-1.5 transition-all duration-300 group-hover:scale-110 shadow-xs",
                service.colorBg
              )}>
                <Icon className={cn("w-5 h-5", service.iconColor)} />
              </div>
              <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors truncate max-w-full">
                {service.label}
              </span>
              <span className="text-[9.5px] font-medium text-muted-foreground/70 truncate max-w-full mt-0.5">
                {service.desc}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
