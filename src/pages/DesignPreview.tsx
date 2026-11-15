import React, { useState } from 'react';
import {
  Bell,
  Home,
  HardHat,
  Clock,
  LayoutGrid,
  ChevronRight,
  ArrowLeft,
  Eye,
  PhoneCall,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  CheckCircle2,
  MapPin,
  Users,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import shipyardDayImg from '../assets/images/shipyard_day_hero_1794698730955.jpg';
import shipyardNightImg from '../assets/images/shipyard_night_hero_1794698732193.jpg';
import hero3dHelmetImg from '../assets/images/hero_3d_helmet_1794698745571.jpg';

type PreviewMode = 'mobile_day' | 'mobile_night' | 'pc_admin';
type MobileTab = 'home' | 'field' | 'hr' | 'all';

/* -------------------------------------------------------------------------- */
/* High-Craft Extruded 3D Clay SVG Icons (Depth Rim + Specular Gloss + Detail)*/
/* -------------------------------------------------------------------------- */
const Icon3DClipboardPro: React.FC<{ className?: string }> = ({ className = 'w-11 h-11' }) => (
  <svg viewBox="0 0 64 64" className={`${className} drop-shadow-[0_6px_10px_rgba(37,99,235,0.32)]`}>
    <defs>
      <linearGradient id="cProBoard" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="60%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
      <linearGradient id="cProClip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
    {/* 3D depth rim */}
    <rect x="12" y="15" width="40" height="44" rx="11" fill="#1E3A8A" />
    {/* Main glossy body */}
    <rect x="12" y="12" width="40" height="44" rx="11" fill="url(#cProBoard)" />
    {/* Paper inset */}
    <rect x="17" y="19" width="30" height="31" rx="6" fill="#FFFFFF" opacity="0.96" />
    {/* Top metallic clip */}
    <rect x="21" y="7" width="22" height="10" rx="5" fill="#B45309" />
    <rect x="21" y="5.5" width="22" height="9.5" rx="4.75" fill="url(#cProClip)" />
    {/* Checklist rows */}
    <circle cx="23" cy="27" r="2.6" fill="#10B981" />
    <rect x="28" y="25" width="14" height="3.8" rx="1.9" fill="#93C5FD" />
    <circle cx="23" cy="35" r="2.6" fill="#3B82F6" />
    <rect x="28" y="33" width="12" height="3.8" rx="1.9" fill="#BFDBFE" />
    <rect x="21" y="41" width="18" height="3.8" rx="1.9" fill="#DBEAFE" />
    {/* Specular top highlight */}
    <path d="M16 15.5C22 13 42 13 48 15.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.45" fill="none" />
  </svg>
);

const Icon3DMealPro: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-11 h-11 drop-shadow-[0_6px_10px_rgba(249,115,22,0.28)]">
    <defs>
      <linearGradient id="mealBox" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FDBA74" />
        <stop offset="50%" stopColor="#FB923C" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>
    </defs>
    {/* Depth */}
    <rect x="7" y="19" width="50" height="36" rx="13" fill="#9A3412" />
    {/* Main tray */}
    <rect x="7" y="15" width="50" height="36" rx="13" fill="url(#mealBox)" />
    {/* Rice & side bowls */}
    <rect x="12" y="20" width="23" height="15" rx="5.5" fill="#FFFBEB" />
    <circle cx="23.5" cy="27.5" r="5" fill="#FDE68A" opacity="0.6" />
    <rect x="38" y="20" width="14" height="15" rx="5.5" fill="#FED7AA" />
    <rect x="12" y="38" width="40" height="8.5" rx="4.25" fill="#FFFFFF" opacity="0.92" />
    {/* Chopsticks accent */}
    <path d="M40 9L54 15" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
    <path d="M36 11L51 17" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Icon3DHelmetPro: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-11 h-11 drop-shadow-[0_6px_10px_rgba(234,179,8,0.3)]">
    <defs>
      <linearGradient id="helmGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="65%" stopColor="#FACC15" />
        <stop offset="100%" stopColor="#CA8A04" />
      </linearGradient>
    </defs>
    {/* Red alert dot */}
    <circle cx="51" cy="14" r="7" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2.5" />
    {/* Helmet shell */}
    <path d="M12 40C12 24 20 15 32 15C44 15 52 24 52 40H12Z" fill="url(#helmGrad)" />
    {/* Center crest */}
    <rect x="28" y="14" width="8" height="24" rx="4" fill="#FEF08A" opacity="0.85" />
    {/* Brim depth */}
    <rect x="8" y="40" width="48" height="7" rx="3.5" fill="#A16207" />
    <rect x="8" y="38.5" width="48" height="6.5" rx="3.25" fill="#EAB308" />
    {/* Gloss */}
    <path d="M18 28C20 22 24 19 27 19" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" fill="none" />
  </svg>
);

const Icon3DPayPro: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-11 h-11 drop-shadow-[0_6px_10px_rgba(16,185,129,0.28)]">
    <defs>
      <linearGradient id="payPro" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6EE7B7" />
        <stop offset="55%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    {/* Back card */}
    <rect x="13" y="9" width="38" height="24" rx="7" fill="#A7F3D0" />
    {/* Wallet depth */}
    <rect x="8" y="19" width="48" height="35" rx="11" fill="#065F46" />
    {/* Wallet face */}
    <rect x="8" y="16" width="48" height="35" rx="11" fill="url(#payPro)" />
    {/* Gold coin clasp */}
    <rect x="37" y="27" width="19" height="13" rx="6.5" fill="#047857" />
    <circle cx="43.5" cy="33.5" r="4.5" fill="#FDE047" />
    <rect x="15" y="25" width="16" height="4.5" rx="2.25" fill="#FFFFFF" opacity="0.9" />
    <rect x="15" y="33" width="11" height="4" rx="2" fill="#D1FAE5" opacity="0.85" />
  </svg>
);

const Icon3DLeavePro: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-11 h-11 drop-shadow-[0_6px_10px_rgba(99,102,241,0.26)]">
    <defs>
      <linearGradient id="calTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#4338CA" />
      </linearGradient>
    </defs>
    <rect x="10" y="17" width="44" height="39" rx="11" fill="#C7D2FE" />
    <rect x="10" y="13" width="44" height="40" rx="11" fill="#FFFFFF" />
    <path d="M10 24C10 17.9 14.9 13 21 13H43C49.1 13 54 17.9 54 24V27H10V24Z" fill="url(#calTop)" />
    <rect x="19" y="7.5" width="5.5" height="11" rx="2.75" fill="#E0E7FF" />
    <rect x="39.5" y="7.5" width="5.5" height="11" rx="2.75" fill="#E0E7FF" />
    <circle cx="22" cy="36" r="4" fill="#4F46E5" />
    <circle cx="33" cy="36" r="4" fill="#E0E7FF" />
    <circle cx="43" cy="36" r="4" fill="#E0E7FF" />
    <rect x="18" y="44" width="28" height="4.5" rx="2.25" fill="#EEF2FF" />
  </svg>
);

const Icon3DHealthPro: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-11 h-11 drop-shadow-[0_6px_10px_rgba(14,165,233,0.28)]">
    <defs>
      <linearGradient id="heartPro" x1="0" y1="0" x2="1" y2="1">
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
      fill="url(#heartPro)"
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

const Icon3DNoticePro: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-11 h-11 drop-shadow-[0_6px_10px_rgba(245,158,11,0.28)]">
    <defs>
      <linearGradient id="megaPro" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FCD34D" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <rect x="17" y="36" width="8" height="16" rx="4" fill="#92400E" />
    <path d="M16 25L47 11V49L16 35V25Z" fill="#B45309" />
    <path d="M16 23L47 9V47L16 33V23Z" fill="url(#megaPro)" />
    <rect x="9" y="22" width="9" height="12" rx="4.5" fill="#FEF3C7" />
    <path d="M52 21C55.5 25 55.5 33 52 37" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
  </svg>
);

export const DesignPreview: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<PreviewMode>('mobile_day');
  const [seniorScale, setSeniorScale] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('home');
  const [mealOrdered, setMealOrdered] = useState<boolean>(true);

  const isNight = mode === 'mobile_night';

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 font-sans">
      {/* Top Control Header */}
      <header className="sticky top-0 z-40 bg-[#0B1220]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="h-9 px-3 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white hover:bg-white/15 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>기존 앱</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-white truncate">
              1번 시안 집중 업그레이드 · 건명 스마트 마린 3D
            </h1>
            <p className="text-[11px] text-slate-300 truncate">
              입체 3D 클레이 아이콘 + 주간/야간 모드 + 하단 탭 전체 화면 + PC 관리자 화면까지 확인하세요.
            </p>
          </div>
        </div>

        {/* Senior Font Toggle */}
        <div className="flex items-center gap-1.5 bg-[#152036] border border-white/15 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setSeniorScale(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              !seniorScale ? 'bg-blue-500 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            20~40대 기본
          </button>
          <button
            type="button"
            onClick={() => setSeniorScale(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
              seniorScale ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>50~60대 큰글씨</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Mode Switcher */}
        <div className="bg-[#11192B] border border-white/10 rounded-2xl p-1.5 inline-flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMode('mobile_day')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              mode === 'mobile_day'
                ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950 shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>모바일 · 주간 3D 마린 (야외 시인성 추천)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('mobile_night')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              mode === 'mobile_night'
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>모바일 · 야간 3D 다크 (자동/수동 전환)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('pc_admin')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              mode === 'pc_admin'
                ? 'bg-white text-slate-950 shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>PC 대표 / 관리자 통합 콘솔</span>
          </button>
        </div>

        {/* ================================================================ */}
        {/* MOBILE PREVIEW (DAY OR NIGHT 3D MARINE UPGRADED)                 */}
        {/* ================================================================ */}
        {mode !== 'pc_admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 flex justify-center">
              <div
                className={`w-full max-w-[404px] rounded-[40px] overflow-hidden shadow-[0_32px_90px_rgba(0,0,0,0.75)] flex flex-col relative min-h-[800px] border-4 transition-colors duration-300 ${
                  isNight
                    ? 'bg-[#080D18] border-[#1E293B] text-white'
                    : 'bg-[#F3F6FB] border-[#1E293B] text-slate-900'
                }`}
              >
                {/* TAB 1: HOME */}
                {mobileTab === 'home' && (
                  <>
                    {/* 3D Atmospheric Dockyard Top Stage */}
                    <div className="relative h-[300px] w-full overflow-hidden shrink-0">
                      <img
                        src={isNight ? shipyardNightImg : shipyardDayImg}
                        alt="건명기업 3D 조선소"
                        className="w-full h-full object-cover"
                      />
                      <div
                        className={`absolute inset-0 ${
                          isNight
                            ? 'bg-gradient-to-b from-[#080D18]/65 via-[#080D18]/20 to-[#080D18]'
                            : 'bg-gradient-to-b from-[#0A254E]/60 via-transparent to-[#F3F6FB]'
                        }`}
                      />

                      {/* Floating Top Header */}
                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                        <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/25 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-black text-white">7공장 · 21.4°C 쾌적</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/25 text-white flex items-center justify-center relative cursor-pointer"
                          >
                            <Bell className="w-4 h-4" />
                            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-rose-500" />
                          </button>
                          <button
                            type="button"
                            className="h-9 px-3 rounded-full bg-rose-600 text-white font-black text-xs flex items-center gap-1 shadow-lg cursor-pointer"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>긴급호출</span>
                          </button>
                        </div>
                      </div>

                      {/* Overlapping Floating Glass Hero Pass */}
                      <div className="absolute bottom-2 left-4 right-4">
                        <div
                          className={`rounded-[26px] p-4 backdrop-blur-xl shadow-2xl border space-y-3 ${
                            isNight
                              ? 'bg-[#111B2E]/88 border-white/15'
                              : 'bg-white/92 border-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-xs font-bold ${isNight ? 'text-cyan-300' : 'text-blue-600'}`}>
                                김철수 반장님 · 외주물량 1팀
                              </p>
                              <p className={`${seniorScale ? 'text-2xl' : 'text-xl'} font-black tabular-nums mt-0.5`}>
                                07:54 정상 출근
                              </p>
                            </div>
                            <span className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-black shadow-sm">
                              근무 6시간째
                            </span>
                          </div>

                          <button
                            type="button"
                            className={`w-full ${seniorScale ? 'py-3.5 text-base' : 'py-3 text-sm'} rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white font-black flex items-center justify-between px-4 shadow-lg shadow-blue-600/25 cursor-pointer active:scale-[0.98] transition-transform`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon3DClipboardPro className="w-8 h-8" />
                              <span>오늘 작업일지 작성하기</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black">
                              미작성 →
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Main Clean Body */}
                    <div className="px-4 pt-3 pb-24 space-y-4 flex-1 overflow-y-auto">
                      {/* 1-Line Live Notice Ticker */}
                      <button
                        type="button"
                        className={`w-full rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer border ${
                          isNight
                            ? 'bg-amber-500/10 border-amber-400/30 text-amber-200'
                            : 'bg-amber-50 border-amber-200 text-amber-950'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-black shrink-0">
                            공지
                          </span>
                          <span className={`${seniorScale ? 'text-sm' : 'text-xs'} font-extrabold truncate`}>
                            오늘 오후 3시 동절기 용접 안전점검 안내
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
                      </button>

                      {/* 6 Extruded 3D Clay Icons on Soft Tinted Squircles (No Boxy Borders!) */}
                      <div className="grid grid-cols-3 gap-y-4 gap-x-3 pt-1">
                        {[
                          {
                            label: '식수 신청',
                            sub: mealOrdered ? '점심 신청됨' : '터치해 신청',
                            icon: <Icon3DMealPro />,
                            bed: isNight ? 'bg-orange-500/15' : 'bg-[#FFF3E6]',
                            onClick: () => setMealOrdered((v) => !v)
                          },
                          {
                            label: '안전·자재',
                            sub: '진행 1건',
                            icon: <Icon3DHelmetPro />,
                            bed: isNight ? 'bg-amber-500/15' : 'bg-[#FEF9C3]'
                          },
                          {
                            label: '급여명세',
                            sub: '10월 도착',
                            icon: <Icon3DPayPro />,
                            bed: isNight ? 'bg-emerald-500/15' : 'bg-[#E7F9F0]'
                          },
                          {
                            label: '연차·휴가',
                            sub: '잔여 11일',
                            icon: <Icon3DLeavePro />,
                            bed: isNight ? 'bg-indigo-500/15' : 'bg-[#EEF2FF]'
                          },
                          {
                            label: '건강체크',
                            sub: '보고 완료',
                            icon: <Icon3DHealthPro />,
                            bed: isNight ? 'bg-sky-500/15' : 'bg-[#E6F6FE]'
                          },
                          {
                            label: '전체 공지',
                            sub: '새 글 2건',
                            icon: <Icon3DNoticePro />,
                            bed: isNight ? 'bg-yellow-500/15' : 'bg-[#FEF3C7]'
                          }
                        ].map((app) => (
                          <button
                            key={app.label}
                            type="button"
                            onClick={app.onClick}
                            className="flex flex-col items-center text-center group cursor-pointer active:scale-95 transition-transform"
                          >
                            <div
                              className={`w-[72px] h-[72px] rounded-[25px] ${app.bed} shadow-[0_8px_20px_rgba(15,23,42,0.08)] flex items-center justify-center group-hover:-translate-y-1 transition-transform`}
                            >
                              {app.icon}
                            </div>
                            <p
                              className={`${seniorScale ? 'text-sm' : 'text-[13px]'} font-black mt-2 leading-tight ${
                                isNight ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {app.label}
                            </p>
                            <p className={`text-[11px] font-bold mt-0.5 ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {app.sub}
                            </p>
                          </button>
                        ))}
                      </div>

                      {/* Bottom 2 Summary Feature Cards (Payroll/Attendance + Ship Welfare) */}
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setMobileTab('hr')}
                          className={`rounded-3xl p-3.5 text-left border cursor-pointer ${
                            isNight
                              ? 'bg-[#121C30] border-white/10'
                              : 'bg-white border-slate-200/80 shadow-xs'
                          }`}
                        >
                          <p className="text-[11px] font-bold text-blue-500">이번 달 출근</p>
                          <p className={`${seniorScale ? 'text-xl' : 'text-lg'} font-black mt-0.5`}>
                            14일 출근
                          </p>
                          <p className={`text-[11px] mt-0.5 ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                            급여·연차 보기 →
                          </p>
                        </button>

                        <button
                          type="button"
                          className={`rounded-3xl p-3.5 text-left border cursor-pointer ${
                            isNight
                              ? 'bg-[#121C30] border-white/10'
                              : 'bg-white border-slate-200/80 shadow-xs'
                          }`}
                        >
                          <p className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            선박·칭찬 포인트
                          </p>
                          <p className={`${seniorScale ? 'text-xl' : 'text-lg'} font-black mt-0.5`}>
                            3 P
                          </p>
                          <p className={`text-[11px] mt-0.5 ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                            15,000원 (1P=5,000원) →
                          </p>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 2: FIELD */}
                {mobileTab === 'field' && (
                  <div className="p-5 pb-24 space-y-4 flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-black">현장 작업 · 안전</h2>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-black">
                        7공장 21.4°C
                      </span>
                    </div>

                    <div
                      className={`rounded-3xl p-4 border flex items-center gap-4 ${
                        isNight ? 'bg-[#121C30] border-white/10' : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <img src={hero3dHelmetImg} alt="3D 안전모" className="w-20 h-20 rounded-2xl object-cover shrink-0" />
                      <div className="space-y-1.5">
                        <span className="text-xs font-black text-blue-500">오늘 필수 작성</span>
                        <p className="text-base font-black">작업일지 작성하기</p>
                        <button
                          type="button"
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black cursor-pointer"
                        >
                          바로 쓰기 →
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {[
                        { title: '안전 · 자재 요청하기', desc: '위험 요소 및 자재 보급 신청', icon: <Icon3DHelmetPro /> },
                        { title: '일일 건강체크 보고', desc: '오늘 정상 보고 완료됨', icon: <Icon3DHealthPro /> },
                        { title: '점심 · 식수 신청', desc: '오늘 중식 신청 완료', icon: <Icon3DMealPro /> }
                      ].map((row) => (
                        <button
                          key={row.title}
                          type="button"
                          className={`w-full rounded-3xl p-4 border flex items-center justify-between text-left cursor-pointer ${
                            isNight ? 'bg-[#121C30] border-white/10' : 'bg-white border-slate-200 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="scale-90">{row.icon}</div>
                            <div>
                              <p className={`${seniorScale ? 'text-base' : 'text-sm'} font-black`}>{row.title}</p>
                              <p className={`text-xs ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>{row.desc}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-50" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: HR & PAYROLL */}
                {mobileTab === 'hr' && (
                  <div className="p-5 pb-24 space-y-4 flex-1 overflow-y-auto">
                    <h2 className="text-xl font-black">내 근태 · 급여 · 연차</h2>

                    <div className="rounded-3xl bg-gradient-to-br from-[#059669] to-[#047857] text-white p-5 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-100">2026년 10월 급여</span>
                        <Icon3DPayPro />
                      </div>
                      <p className="text-xl font-black">급여명세서 도착 완료</p>
                      <button
                        type="button"
                        className="w-full py-3 rounded-2xl bg-white text-emerald-900 font-black text-xs cursor-pointer"
                      >
                        명세서 상세 열어보기 →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div
                        className={`rounded-3xl p-4 border ${
                          isNight ? 'bg-[#121C30] border-white/10' : 'bg-white border-slate-200'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-400">이번 달 출근</p>
                        <p className="text-2xl font-black mt-1">14일</p>
                      </div>
                      <div
                        className={`rounded-3xl p-4 border ${
                          isNight ? 'bg-[#121C30] border-white/10' : 'bg-white border-slate-200'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-400">남은 연차</p>
                        <p className="text-2xl font-black text-blue-500 mt-1">11일</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`w-full rounded-3xl p-4 border flex items-center justify-between cursor-pointer ${
                        isNight ? 'bg-[#121C30] border-white/10' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon3DLeavePro />
                        <div className="text-left">
                          <p className="text-sm font-black">연차 · 휴가 신청</p>
                          <p className="text-xs text-slate-400">원하는 날짜를 선택해 신청하세요</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-50" />
                    </button>
                  </div>
                )}

                {/* TAB 4: ALL MENUS (ORGANIZED INTO 3 CLEAN GROUPS!) */}
                {mobileTab === 'all' && (
                  <div className="p-5 pb-24 space-y-4 flex-1 overflow-y-auto">
                    <h2 className="text-xl font-black">전체 메뉴 (3개 그룹 정리)</h2>
                    {[
                      {
                        group: '1. 현장 업무',
                        items: ['작업일지 작성', '안전·자재 요청', '일일 건강체크', '현장 체감온도']
                      },
                      {
                        group: '2. 출퇴근 · 급여',
                        items: ['출퇴근 기록부', '급여명세서', '연차 · 휴가 신청']
                      },
                      {
                        group: '3. 사내 소통 · 복지',
                        items: ['식수 · 도시락 신청', '전사 공지사항', '칭찬 · 보상몰', '선박 미니게임']
                      }
                    ].map((sec) => (
                      <div
                        key={sec.group}
                        className={`rounded-3xl p-4 border space-y-2 ${
                          isNight ? 'bg-[#121C30] border-white/10' : 'bg-white border-slate-200'
                        }`}
                      >
                        <p className="text-xs font-black text-blue-500">{sec.group}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {sec.items.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className={`px-3 py-2.5 rounded-2xl text-left text-xs font-black cursor-pointer ${
                                isNight
                                  ? 'bg-white/5 hover:bg-white/10 text-white'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Floating Capsule Bottom Navigation (Interactive!) */}
                <div
                  className={`absolute bottom-3 left-4 right-4 h-15 rounded-full backdrop-blur-xl border grid grid-cols-4 items-center px-2 shadow-xl ${
                    isNight
                      ? 'bg-[#111B2E]/92 border-white/15'
                      : 'bg-white/95 border-slate-200/80'
                  }`}
                >
                  {[
                    { id: 'home', label: '홈', icon: Home },
                    { id: 'field', label: '현장', icon: HardHat },
                    { id: 'hr', label: '근태·급여', icon: Clock },
                    { id: 'all', label: '전체메뉴', icon: LayoutGrid }
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = mobileTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setMobileTab(t.id as MobileTab)}
                        className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
                          active
                            ? isNight
                              ? 'text-amber-400'
                              : 'text-blue-600'
                            : isNight
                              ? 'text-slate-400'
                              : 'text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[11px] font-black">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Design Breakdown */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-[#11192B] border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-black text-sky-400">
                    1번 업그레이드 · 입체 3D 클레이 아이콘 + 주간/야간 모드 + 전 탭 동작 체험
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white">
                  하단 탭 [홈 / 현장 / 근태·급여 / 전체메뉴]를 직접 눌러보세요!
                </h2>
                <ul className="space-y-3 text-sm text-slate-300 leading-relaxed">
                  <li>
                    <strong className="text-white">• 입체 3D 클레이 아이콘 대폭 강화:</strong>{' '}
                    단순 선 아이콘이나 납작한 그림 대신, 두께감·빛 반사·그림자가 살아있는 3D 클레이 아이콘을 부드러운 파스텔 배경 위에 띄웠습니다.
                  </li>
                  <li>
                    <strong className="text-white">• 3D 조선소 도크 위에 떠 있는 [오늘 작업일지] 카드:</strong>{' '}
                    젊은 직원들에겐 세련된 3D 조선소 앱으로 보이고, 50~60대 직원들에겐 출근 확인과 작업일지 버튼이 화면 맨 위에 바로 떠 있어 절대 헷갈리지 않습니다.
                  </li>
                  <li>
                    <strong className="text-white">• 14개 넘던 난잡한 메뉴를 6+2 구조로 정리:</strong>{' '}
                    홈에는 가장 자주 쓰는 6개 입체 아이콘 + 2개 요약 카드만 두고, 나머지는 [전체메뉴] 탭 안에 3개 그룹으로 깔끔하게 모았습니다.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* PC ADMIN CONSOLE PREVIEW (SAME MARINE 3D SYSTEM)                 */}
        {/* ================================================================ */}
        {mode === 'pc_admin' && (
          <div className="bg-[#0E1525] border border-white/15 rounded-[28px] overflow-hidden shadow-2xl">
            <div className="grid grid-cols-12 min-h-[640px]">
              {/* Left Clean 4-Group Sidebar */}
              <aside className="col-span-12 md:col-span-3 bg-[#090E1A] border-r border-white/10 p-5 space-y-6">
                <div className="flex items-center gap-3">
                  <img src={shipyardDayImg} alt="로고" className="w-10 h-10 rounded-xl object-cover" />
                  <div>
                    <p className="text-sm font-black text-white">건명기업 관리자</p>
                    <p className="text-[11px] text-cyan-400 font-bold">대표 / 현장 관제 콘솔</p>
                  </div>
                </div>

                {/* 4 Clean Groups instead of 25 cluttered items */}
                <div className="space-y-4">
                  {[
                    {
                      group: '대시보드',
                      items: ['종합 관제 홈', '공장 체류시간 통계'],
                      active: '공장 체류시간 통계'
                    },
                    {
                      group: '인사 · 근태 · 급여',
                      items: ['출퇴근 통합 관리', '연차 · 휴가 결재', '급여명세서 배포']
                    },
                    {
                      group: '현장 · 안전 · 식수',
                      items: ['작업일지 모아보기', '식수 현황표', '안전·자재 요청함']
                    },
                    {
                      group: '설정',
                      items: ['직원 · 권한 관리', '공장 GPS 좌표 보정']
                    }
                  ].map((sec) => (
                    <div key={sec.group} className="space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-500 px-2">{sec.group}</p>
                      {sec.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                            sec.active === item
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </aside>

              {/* Main PC Workspace */}
              <main className="col-span-12 md:col-span-9 p-6 space-y-6 bg-[#F4F7FB] text-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">오늘 현장 & 공장 체류시간 현황</h2>
                    <p className="text-xs font-bold text-slate-500">
                      모바일 3D 마린 디자인과 통일된 밝고 깨끗한 대표 전용 PC 화면
                    </p>
                  </div>
                  <span className="px-3.5 py-2 rounded-xl bg-[#0A254E] text-white text-xs font-black flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    자동 GPS 백그라운드 수집 정상 가동
                  </span>
                </div>

                {/* 4 Clean KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '오늘 출근 인원', val: '42 / 45명', sub: '정상 출근율 93%', icon: Users, color: 'text-blue-600' },
                    { label: '공장 내 체류 중', val: '38명', sub: '7공장 26 · 8공장 12', icon: MapPin, color: 'text-emerald-600' },
                    { label: '작업일지 미작성', val: '3건', sub: '오후 5시 마감', icon: CheckCircle2, color: 'text-amber-600' },
                    { label: '오늘 점심 식수', val: '41명', sub: '조식 12 · 중식 41', icon: Sparkles, color: 'text-indigo-600' }
                  ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                      <div key={kpi.label} className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">{kpi.label}</span>
                          <Icon className={`w-4 h-4 ${kpi.color}`} />
                        </div>
                        <p className="text-2xl font-black text-slate-900 mt-2">{kpi.val}</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">{kpi.sub}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Clean Factory Stay Duration Table Preview */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900">작업자별 공장 체류시간 기록 (실시간 요약)</h3>
                    <span className="text-xs font-bold text-blue-600">엑셀 내보내기 →</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {[
                      { name: '김철수 반장', team: '외주물량 1팀', zone: '중형선 7공장', stay: '6시간 42분 체류', badge: '공장 내' },
                      { name: '박영호 반장', team: '선각 2팀', zone: '중형선 8공장', stay: '6시간 18분 체류', badge: '공장 내' },
                      { name: '이정민 기사', team: '의장 1팀', zone: '외부 이동 중', stay: '4시간 10분 체류', badge: '외부' }
                    ].map((row) => (
                      <div key={row.name} className="py-3 flex items-center justify-between">
                        <div>
                          <span className="font-black text-slate-900">{row.name}</span>
                          <span className="text-slate-400 ml-2">{row.team}</span>
                        </div>
                        <span className="font-bold text-slate-600">{row.zone}</span>
                        <span className="font-black text-blue-700">{row.stay}</span>
                        <span
                          className={`px-2.5 py-1 rounded-full font-black ${
                            row.badge === '공장 내'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {row.badge}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </main>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignPreview;
