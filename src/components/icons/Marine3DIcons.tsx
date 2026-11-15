import React from 'react';

/* -------------------------------------------------------------------------- */
/* Extruded 3D Clay SVG Icons — Concept 1 (3D Marine Launcher System)         */
/* -------------------------------------------------------------------------- */

export const Icon3DClipboard: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(37,99,235,0.3)]`}>
    <defs>
      <linearGradient id="m3dBoard" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="60%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
      <linearGradient id="m3dClip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
    <rect x="12" y="15" width="40" height="44" rx="11" fill="#1E3A8A" />
    <rect x="12" y="12" width="40" height="44" rx="11" fill="url(#m3dBoard)" />
    <rect x="17" y="19" width="30" height="31" rx="6" fill="#FFFFFF" opacity="0.96" />
    <rect x="21" y="7" width="22" height="10" rx="5" fill="#B45309" />
    <rect x="21" y="5.5" width="22" height="9.5" rx="4.75" fill="url(#m3dClip)" />
    <circle cx="23" cy="27" r="2.6" fill="#10B981" />
    <rect x="28" y="25" width="14" height="3.8" rx="1.9" fill="#93C5FD" />
    <circle cx="23" cy="35" r="2.6" fill="#3B82F6" />
    <rect x="28" y="33" width="12" height="3.8" rx="1.9" fill="#BFDBFE" />
    <rect x="21" y="41" width="18" height="3.8" rx="1.9" fill="#DBEAFE" />
    <path d="M16 15.5C22 13 42 13 48 15.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.45" fill="none" />
  </svg>
);

export const Icon3DMeal: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(249,115,22,0.28)]`}>
    <defs>
      <linearGradient id="m3dMeal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FDBA74" />
        <stop offset="50%" stopColor="#FB923C" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>
    </defs>
    <rect x="7" y="19" width="50" height="36" rx="13" fill="#9A3412" />
    <rect x="7" y="15" width="50" height="36" rx="13" fill="url(#m3dMeal)" />
    <rect x="12" y="20" width="23" height="15" rx="5.5" fill="#FFFBEB" />
    <circle cx="23.5" cy="27.5" r="5" fill="#FDE68A" opacity="0.6" />
    <rect x="38" y="20" width="14" height="15" rx="5.5" fill="#FED7AA" />
    <rect x="12" y="38" width="40" height="8.5" rx="4.25" fill="#FFFFFF" opacity="0.92" />
    <path d="M40 9L54 15" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
    <path d="M36 11L51 17" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Icon3DHelmet: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(234,179,8,0.3)]`}>
    <defs>
      <linearGradient id="m3dHelm" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="65%" stopColor="#FACC15" />
        <stop offset="100%" stopColor="#CA8A04" />
      </linearGradient>
    </defs>
    <circle cx="51" cy="14" r="6.5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
    <path d="M12 40C12 24 20 15 32 15C44 15 52 24 52 40H12Z" fill="url(#m3dHelm)" />
    <rect x="28" y="14" width="8" height="24" rx="4" fill="#FEF08A" opacity="0.85" />
    <rect x="8" y="40" width="48" height="7" rx="3.5" fill="#A16207" />
    <rect x="8" y="38.5" width="48" height="6.5" rx="3.25" fill="#EAB308" />
    <path d="M18 28C20 22 24 19 27 19" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" fill="none" />
  </svg>
);

export const Icon3DPay: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(16,185,129,0.28)]`}>
    <defs>
      <linearGradient id="m3dPay" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6EE7B7" />
        <stop offset="55%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <rect x="13" y="9" width="38" height="24" rx="7" fill="#A7F3D0" />
    <rect x="8" y="19" width="48" height="35" rx="11" fill="#065F46" />
    <rect x="8" y="16" width="48" height="35" rx="11" fill="url(#m3dPay)" />
    <rect x="37" y="27" width="19" height="13" rx="6.5" fill="#047857" />
    <circle cx="43.5" cy="33.5" r="4.5" fill="#FDE047" />
    <rect x="15" y="25" width="16" height="4.5" rx="2.25" fill="#FFFFFF" opacity="0.9" />
    <rect x="15" y="33" width="11" height="4" rx="2" fill="#D1FAE5" opacity="0.85" />
  </svg>
);

export const Icon3DLeave: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(99,102,241,0.26)]`}>
    <defs>
      <linearGradient id="m3dCal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#4338CA" />
      </linearGradient>
    </defs>
    <rect x="10" y="17" width="44" height="39" rx="11" fill="#C7D2FE" />
    <rect x="10" y="13" width="44" height="40" rx="11" fill="#FFFFFF" />
    <path d="M10 24C10 17.9 14.9 13 21 13H43C49.1 13 54 17.9 54 24V27H10V24Z" fill="url(#m3dCal)" />
    <rect x="19" y="7.5" width="5.5" height="11" rx="2.75" fill="#E0E7FF" />
    <rect x="39.5" y="7.5" width="5.5" height="11" rx="2.75" fill="#E0E7FF" />
    <circle cx="22" cy="36" r="4" fill="#4F46E5" />
    <circle cx="33" cy="36" r="4" fill="#E0E7FF" />
    <circle cx="43" cy="36" r="4" fill="#E0E7FF" />
    <rect x="18" y="44" width="28" height="4.5" rx="2.25" fill="#EEF2FF" />
  </svg>
);

export const Icon3DHealth: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(14,165,233,0.28)]`}>
    <defs>
      <linearGradient id="m3dHeart" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0284C7" />
      </linearGradient>
    </defs>
    <path
      d="M32 56C32 56 9 41.5 9 24.5C9 16.5 15.2 11 22.5 11C27.2 11 30.8 13.5 32 16.5C33.2 13.5 36.8 11 41.5 11C48.8 11 55 16.5 55 24.5C55 41.5 32 56 32 56Z"
      fill="#0369A1"
    />
    <path
      d="M32 53C32 53 9 38.5 9 22.5C9 14.5 15.2 9 22.5 9C27.2 9 30.8 11.5 32 14.5C33.2 11.5 36.8 9 41.5 9C48.8 9 55 14.5 55 22.5C55 38.5 32 53 32 53Z"
      fill="url(#m3dHeart)"
    />
    <path
      d="M18 29H24.5L28 21.5L33 36.5L37 27L40 29H46"
      stroke="#FFFFFF"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const Icon3DNotice: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(245,158,11,0.28)]`}>
    <defs>
      <linearGradient id="m3dMega" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FCD34D" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <rect x="17" y="36" width="8" height="16" rx="4" fill="#92400E" />
    <path d="M16 25L47 11V49L16 35V25Z" fill="#B45309" />
    <path d="M16 23L47 9V47L16 33V23Z" fill="url(#m3dMega)" />
    <rect x="9" y="22" width="9" height="12" rx="4.5" fill="#FEF3C7" />
    <path d="M52 21C55.5 25 55.5 33 52 37" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
  </svg>
);

export const Icon3DClock: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(59,130,246,0.28)]`}>
    <defs>
      <linearGradient id="m3dClock" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="34" r="23" fill="#1E3A8A" />
    <circle cx="32" cy="31" r="23" fill="url(#m3dClock)" />
    <circle cx="32" cy="31" r="17" fill="#FFFFFF" />
    <path d="M32 20V31L40 35" stroke="#1D4ED8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="32" cy="31" r="3" fill="#F59E0B" />
  </svg>
);

export const Icon3DThermometer: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(244,63,94,0.28)]`}>
    <defs>
      <linearGradient id="m3dTemp" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#E11D48" />
        <stop offset="100%" stopColor="#FB7185" />
      </linearGradient>
    </defs>
    <rect x="24" y="10" width="16" height="36" rx="8" fill="#E2E8F0" />
    <circle cx="32" cy="45" r="12" fill="#E2E8F0" />
    <rect x="28" y="20" width="8" height="25" rx="4" fill="url(#m3dTemp)" />
    <circle cx="32" cy="45" r="8.5" fill="url(#m3dTemp)" />
    <circle cx="29" cy="42" r="2.5" fill="#FFFFFF" opacity="0.55" />
  </svg>
);

export const Icon3DShip: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(14,165,233,0.28)]`}>
    <defs>
      <linearGradient id="m3dHull" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    <rect x="22" y="13" width="20" height="17" rx="4" fill="#FFFFFF" />
    <rect x="27" y="17" width="10" height="5" rx="2" fill="#0284C7" />
    <path d="M10 30H54L47 47H17L10 30Z" fill="url(#m3dHull)" />
    <path d="M8 51C14 47 22 55 32 51C42 47 50 55 56 51" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
  </svg>
);

export const Icon3DPraise: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(236,72,153,0.28)]`}>
    <defs>
      <linearGradient id="m3dPraise" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#DB2777" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="34" r="21" fill="#9D174D" />
    <circle cx="32" cy="31" r="21" fill="url(#m3dPraise)" />
    <path d="M32 19L35.5 26.5L43.5 27.5L37.5 33L39 41L32 37L25 41L26.5 33L20.5 27.5L28.5 26.5L32 19Z" fill="#FDE047" />
  </svg>
);

export const Icon3DBook: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(168,85,247,0.28)]`}>
    <defs>
      <linearGradient id="m3dBook" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#C084FC" />
        <stop offset="100%" stopColor="#7E22CE" />
      </linearGradient>
    </defs>
    <rect x="13" y="13" width="38" height="42" rx="8" fill="#581C87" />
    <rect x="13" y="10" width="38" height="42" rx="8" fill="url(#m3dBook)" />
    <rect x="19" y="16" width="26" height="12" rx="4" fill="#FFFFFF" opacity="0.92" />
    <rect x="19" y="33" width="20" height="4" rx="2" fill="#E9D5FF" />
    <rect x="19" y="40" width="14" height="4" rx="2" fill="#E9D5FF" />
  </svg>
);

export const getService3DIcon = (id: string, className = 'w-10 h-10'): React.ReactNode => {
  switch (id) {
    case 'worklog':
    case 'personal-work-log':
      return <Icon3DClipboard className={className} />;
    case 'meal':
      return <Icon3DMeal className={className} />;
    case 'request':
    case 'accidents':
      return <Icon3DHelmet className={className} />;
    case 'payslip':
      return <Icon3DPay className={className} />;
    case 'leave':
      return <Icon3DLeave className={className} />;
    case 'health':
      return <Icon3DHealth className={className} />;
    case 'temp':
      return <Icon3DThermometer className={className} />;
    case 'attendance':
    case 'settings':
      return <Icon3DClock className={className} />;
    case 'training':
      return <Icon3DBook className={className} />;
    case 'praise':
    case 'ranking':
    case 'redemption':
    case 'coupons':
      return <Icon3DPraise className={className} />;
    case 'ship':
    case 'lotto':
    case 'entertainment':
      return <Icon3DShip className={className} />;
    default:
      return <Icon3DNotice className={className} />;
  }
};

export const getServiceSoftBedClass = (id: string, isLight = true): string => {
  if (!isLight) {
    switch (id) {
      case 'worklog':
      case 'attendance':
      case 'settings':
        return 'bg-blue-500/15';
      case 'meal':
        return 'bg-orange-500/15';
      case 'request':
      case 'accidents':
        return 'bg-amber-500/15';
      case 'payslip':
        return 'bg-emerald-500/15';
      case 'leave':
        return 'bg-indigo-500/15';
      case 'health':
        return 'bg-sky-500/15';
      case 'temp':
        return 'bg-rose-500/15';
      case 'training':
        return 'bg-purple-500/15';
      case 'praise':
      case 'ranking':
        return 'bg-pink-500/15';
      case 'ship':
        return 'bg-cyan-500/15';
      default:
        return 'bg-amber-500/15';
    }
  }

  switch (id) {
    case 'worklog':
    case 'attendance':
    case 'settings':
      return 'bg-[#EFF6FF]';
    case 'meal':
      return 'bg-[#FFF3E6]';
    case 'request':
    case 'accidents':
      return 'bg-[#FEF9C3]';
    case 'payslip':
      return 'bg-[#E7F9F0]';
    case 'leave':
      return 'bg-[#EEF2FF]';
    case 'health':
      return 'bg-[#E6F6FE]';
    case 'temp':
      return 'bg-[#FFE4E6]';
    case 'training':
      return 'bg-[#F3E8FF]';
    case 'praise':
    case 'ranking':
    case 'redemption':
    case 'coupons':
      return 'bg-[#FCE7F3]';
    case 'ship':
    case 'lotto':
    case 'entertainment':
      return 'bg-[#E0F2FE]';
    default:
      return 'bg-[#FEF3C7]';
  }
};
