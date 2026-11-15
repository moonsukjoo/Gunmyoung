import React from 'react';
import shipyardDayImg from '@/assets/images/shipyard_day_hero_1794698730955.jpg';
import shipyardNightImg from '@/assets/images/shipyard_night_hero_1794698732193.jpg';
import { cn } from '@/lib/utils';

interface MarineSubpageHeroProps {
  isLight: boolean;
  highContrast?: boolean;
  icon: React.ReactNode;
  iconBedClass?: string;
  subtitle: string;
  title: string;
  rightAction?: React.ReactNode;
  children?: React.ReactNode;
}

export const MarineSubpageHero: React.FC<MarineSubpageHeroProps> = ({
  isLight,
  highContrast = false,
  icon,
  iconBedClass,
  subtitle,
  title,
  rightAction,
  children,
}) => {
  return (
    <section className="relative w-full">
      {/* Compact 3D Atmospheric Dockyard Backdrop */}
      <div className="relative h-[126px] w-full overflow-hidden">
        <img
          src={isLight ? shipyardDayImg : shipyardNightImg}
          alt="건명기업 조선소 도크"
          className="w-full h-full object-cover"
        />
        <div
          className={cn(
            'absolute inset-0',
            highContrast
              ? 'bg-background/85'
              : isLight
                ? 'bg-gradient-to-b from-[#0A254E]/55 via-[#0A254E]/15 to-[#F3F6FB]'
                : 'bg-gradient-to-b from-[#080D18]/65 via-[#080D18]/30 to-[#080D18]'
          )}
        />
      </div>

      {/* Overlapping Pearl / Marine Floating Pass */}
      <div className="px-4 -mt-[78px] relative z-10">
        <div
          className={cn(
            'rounded-[26px] p-4 backdrop-blur-xl border space-y-3.5 transition-colors',
            highContrast
              ? 'bg-card border-border text-foreground shadow-none'
              : isLight
                ? 'bg-white/95 border-white text-slate-900 shadow-[0_16px_40px_rgba(15,23,42,0.10)]'
                : 'bg-[#111B2E]/92 border-white/15 text-white shadow-[0_18px_42px_rgba(0,0,0,0.45)]'
          )}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  'w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 shadow-xs',
                  iconBedClass || (isLight ? 'bg-[#EFF6FF]' : 'bg-blue-500/15')
                )}
              >
                {icon}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-[11px] font-bold truncate',
                    highContrast ? 'text-primary' : isLight ? 'text-blue-600' : 'text-cyan-300'
                  )}
                >
                  {subtitle}
                </p>
                <h1 className="text-xl font-black tracking-tight leading-tight truncate mt-0.5">
                  {title}
                </h1>
              </div>
            </div>

            {rightAction && <div className="shrink-0">{rightAction}</div>}
          </div>

          {children}
        </div>
      </div>
    </section>
  );
};
