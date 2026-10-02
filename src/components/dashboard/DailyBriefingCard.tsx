import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Megaphone,
  AlertTriangle,
  Crown,
  Volume2,
  ChevronRight,
  Heart
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Notice, AccidentCase, UserProfile } from '@/types';
import { AlertSoundPlayer } from '@/lib/sound';

interface DailyBriefingCardProps {
  briefingTab: 'NOTICES' | 'ACCIDENTS' | 'PRAISE';
  setBriefingTab: (tab: 'NOTICES' | 'ACCIDENTS' | 'PRAISE') => void;
  recentNotices: Notice[];
  recentAccidents: AccidentCase[];
  praiseKings: UserProfile[];
  onSelectNotice: (notice: Notice) => void;
  onSelectAccident: (accident: AccidentCase) => void;
}

export const DailyBriefingCard: React.FC<DailyBriefingCardProps> = ({
  briefingTab,
  setBriefingTab,
  recentNotices,
  recentAccidents,
  praiseKings,
  onSelectNotice,
  onSelectAccident
}) => {
  const navigate = useNavigate();

  return (
    <section className="space-y-2.5">
      {/* Tab Selector Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex-1 flex items-center bg-muted/70 p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setBriefingTab('NOTICES')}
            className={cn(
              "flex-1 py-1.5 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center flex items-center justify-center gap-1",
              briefingTab === 'NOTICES'
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>📢 공지사항</span>
            <span className="text-[10px] font-bold opacity-75">({recentNotices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setBriefingTab('ACCIDENTS')}
            className={cn(
              "flex-1 py-1.5 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center flex items-center justify-center gap-1",
              briefingTab === 'ACCIDENTS'
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>⚠️ 사고사례</span>
            <span className="text-[10px] font-bold opacity-75">({recentAccidents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setBriefingTab('PRAISE')}
            className={cn(
              "flex-1 py-1.5 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center flex items-center justify-center gap-1",
              briefingTab === 'PRAISE'
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>👑 칭찬왕</span>
          </button>
        </div>

        <div className="shrink-0">
          {briefingTab === 'NOTICES' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] font-black text-muted-foreground hover:text-primary rounded-lg px-2 cursor-pointer whitespace-nowrap"
              onClick={() => navigate('/notices')}
            >
              더보기 <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          )}
          {briefingTab === 'ACCIDENTS' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] font-black text-muted-foreground hover:text-primary rounded-lg px-2 cursor-pointer whitespace-nowrap"
              onClick={() => navigate('/accidents')}
            >
              더보기 <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          )}
          {briefingTab === 'PRAISE' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] font-black text-primary hover:text-primary rounded-lg px-2 cursor-pointer whitespace-nowrap"
              onClick={() => navigate('/praise-feed')}
            >
              칭찬하기 <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Tab Content Card */}
      <Card className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-2">
        {/* TAB 1: NOTICES */}
        {briefingTab === 'NOTICES' && (
          <div className="divide-y divide-border/20">
            {recentNotices.length > 0 ? (
              recentNotices.map((notice) => (
                <div
                  key={notice.id}
                  className="p-3 hover:bg-muted/50 active:bg-muted/80 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  onClick={() => onSelectNotice(notice)}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      {notice.isImportant && (
                        <Badge className="bg-rose-500 hover:bg-rose-600 text-[9px] font-black h-4 px-1.5 rounded-md leading-none text-white">
                          중요
                        </Badge>
                      )}
                      <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {notice.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground/75 line-clamp-1">
                      {notice.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 rounded-full text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        AlertSoundPlayer.trigger('notice', `${notice.title}. ${notice.content}`);
                      }}
                      title="음성으로 듣기"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      {format(new Date(notice.createdAt), 'MM/dd')}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-muted-foreground/40 text-xs font-bold">
                등록된 공지사항이 없습니다.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACCIDENTS */}
        {briefingTab === 'ACCIDENTS' && (
          <div className="divide-y divide-border/20">
            {recentAccidents.length > 0 ? (
              recentAccidents.map((accCase) => (
                <div
                  key={accCase.id}
                  className="p-3 hover:bg-muted/50 active:bg-muted/80 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  onClick={() => onSelectAccident(accCase)}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "text-[9px] font-black h-4 px-1.5 rounded-md leading-none text-white",
                        accCase.severity === 'HIGH' ? "bg-red-500" : accCase.severity === 'MEDIUM' ? "bg-orange-500" : "bg-emerald-500"
                      )}>
                        {accCase.severity === 'HIGH' ? '중대' : accCase.severity === 'MEDIUM' ? '경미' : '아차'}
                      </Badge>
                      <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {accCase.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground/75 line-clamp-1">
                      위치: {accCase.location} {accCase.description ? `• ${accCase.description}` : ''}
                    </p>
                  </div>

                  <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                    {accCase.date ? format(new Date(accCase.date), 'MM/dd') : ''}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-muted-foreground/40 text-xs font-bold">
                최근 사고사례가 없습니다.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PRAISE KINGS */}
        {briefingTab === 'PRAISE' && (
          <div className="space-y-1.5 p-1">
            {praiseKings.slice(0, 3).map((king, index) => {
              const currentMonth = format(new Date(), 'yyyy-MM');
              const monthlyCount = king.kudosMonth === currentMonth ? (king.monthlyKudosCount || 0) : 0;
              const points = king.points || 0;
              const isTop1 = index === 0;

              return (
                <div
                  key={king.uid}
                  onClick={() => navigate('/praise-feed')}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer active:scale-98",
                    isTop1 ? "bg-amber-500/10 border-amber-500/30" : "bg-card border-border/40 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                      isTop1 ? "bg-amber-500 text-slate-950 shadow-xs" : index === 1 ? "bg-slate-300 text-slate-900" : "bg-amber-700 text-white"
                    )}>
                      {isTop1 ? <Crown className="w-3.5 h-3.5 fill-current" /> : index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-foreground truncate">
                          {king.displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {king.position || '사원'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 truncate">
                        {king.departmentName || '경영혁신부'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full text-pink-600 dark:text-pink-400">
                      <Heart className="w-2.5 h-2.5 fill-pink-500" />
                      <span className="text-[11px] font-black font-mono">{points.toLocaleString()}P</span>
                    </div>
                    {monthlyCount > 0 && (
                      <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                        이달 {monthlyCount}회
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
};
