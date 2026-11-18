import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { 
  LayoutDashboard, 
  Clock, 
  Bell, 
  Users, 
  LogOut, 
  User,
  ShieldAlert,
  ChevronLeft,
  Settings,
  ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth, db } from '@/firebase';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './CompanyLogo';
import { collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { sendPushNotification } from '../services/notificationService';
import { CriticalIncidentAlertCenter } from './CriticalIncidentAlertCenter';

import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  active: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, active }) => (
  <Link
    to={to}
    className={cn(
      "flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all duration-200 relative rounded-full",
      active ? "text-[#2563EB] dark:text-primary" : "text-muted-foreground hover:text-foreground"
    )}
  >
    <div className={cn(
      "w-11 h-6 rounded-full transition-all duration-200 flex items-center justify-center",
      active ? "bg-[#2563EB]/12 text-[#2563EB]" : "bg-transparent"
    )}>
      <Icon className={cn("w-[18px] h-[18px] transition-transform duration-200", active && "scale-110")} />
    </div>
    <span className={cn(
      "text-[11px] font-black tracking-tight transition-all leading-none whitespace-nowrap",
      active ? "opacity-100 text-[#2563EB]" : "opacity-75"
    )}>
      {label}
    </span>
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSOSDialogOpen, setIsSOSDialogOpen] = useState(false);
  const [isSOSLoading, setIsSOSLoading] = useState(false);

  // Automatically scroll container and window to top on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  const lightTheme = profile?.lightTheme !== false;
  const highContrast = profile?.highContrast;

  useEffect(() => {
    // Apply light-theme and high-contrast classes to body to ensure backgrounds and scrollbars update
    if (lightTheme) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }

    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [lightTheme, highContrast]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', profile.uid),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
      
      // Trigger local notification for new arrivals if not initially loading
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const rawCreated = data.createdAt;
          const createdDate = typeof rawCreated?.toDate === 'function'
            ? rawCreated.toDate()
            : typeof rawCreated?.seconds === 'number'
              ? new Date(rawCreated.seconds * 1000)
              : rawCreated ? new Date(rawCreated) : null;
          const isNew = createdDate && !isNaN(createdDate.getTime()) && createdDate.getTime() > Date.now() - 10000;
          if (isNew) {
            sendPushNotification(data.title, {
              body: data.message,
              data: { type: data.type, id: change.doc.id }
            });
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications_unread');
    });
    return () => unsubscribe();
  }, [profile]);

  const [hasImportantNotice, setHasImportantNotice] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'notices'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const hasImportant = docs.some(doc => {
        const isImportant = doc.isImportant === true || doc.priority === 'high' || doc.priority === 'URGENT';
        if (!isImportant) return false;
        
        let createdAtDate: Date;
        if (doc.createdAt) {
          if (typeof doc.createdAt === 'string' || typeof doc.createdAt === 'number') {
            createdAtDate = new Date(doc.createdAt);
          } else if (typeof doc.createdAt.toDate === 'function') {
            createdAtDate = doc.createdAt.toDate();
          } else if (typeof doc.createdAt.seconds === 'number') {
            createdAtDate = new Date(doc.createdAt.seconds * 1000);
          } else {
            createdAtDate = new Date();
          }
        } else {
          createdAtDate = new Date();
        }
        if (isNaN(createdAtDate.getTime())) createdAtDate = new Date();
        
        // Is recent (within last 7 days)
        const isRecent = Date.now() - createdAtDate.getTime() < 7 * 24 * 60 * 60 * 1000;
        
        // Is unread (createdAt is newer than lastViewedNoticesTime)
        const lastViewed = localStorage.getItem('lastViewedNoticesTime');
        const lastViewedMs = lastViewed ? new Date(lastViewed).getTime() : NaN;
        const isUnread = !lastViewed || isNaN(lastViewedMs) || createdAtDate.getTime() > lastViewedMs + 1000;
        
        return isRecent && isUnread;
      });
      setHasImportantNotice(hasImportant);
    }, (error) => {
      console.error("Error listening to notices for alert pulse:", error);
    });
    return () => unsubscribe();
  }, [profile, location.pathname]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const handleEmergencySOS = async (type: string) => {
    if (!profile) return;
    setIsSOSLoading(true);

    try {
      const directorsQuery = query(collection(db, 'users'), where('role', '==', 'DIRECTOR'));
      const safetyManagersQuery = query(collection(db, 'users'), where('role', '==', 'SAFETY_MANAGER'));
      const teamLeadersQuery = query(
        collection(db, 'users'), 
        where('role', '==', 'TEAM_LEADER'),
        where('departmentId', '==', profile.departmentId || '')
      );

      const [directorsSnap, safetySnap, teamLeadersSnap] = await Promise.all([
        getDocs(directorsQuery),
        getDocs(safetyManagersQuery),
        getDocs(teamLeadersQuery)
      ]);

      const targetUids = new Set<string>();
      directorsSnap.docs.forEach(d => targetUids.add(d.id));
      safetySnap.docs.forEach(d => targetUids.add(d.id));
      teamLeadersSnap.docs.forEach(d => targetUids.add(d.id));
      
      const ceoQuery = query(collection(db, 'users'), where('role', '==', 'CEO'));
      const ceoSnap = await getDocs(ceoQuery);
      ceoSnap.docs.forEach(d => targetUids.add(d.id));

      targetUids.delete(profile.uid);

      await addDoc(collection(db, 'emergencyLogs'), {
        uid: profile.uid,
        displayName: profile.displayName,
        type,
        location: profile.workplace || '현장',
        createdAt: new Date().toISOString()
      });

      // Create critical Incident record for superior check-in
      await addDoc(collection(db, 'criticalIncidents'), {
        type: 'SOS',
        typeName: `비상 SOS (${type})`,
        uid: profile.uid,
        displayName: profile.displayName || '이름없음',
        employeeId: profile.employeeId || '',
        departmentName: profile.departmentName || '미지정',
        jobRole: profile.jobRole || '',
        workplace: profile.workplace || '현장',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      const notificationPromises = Array.from(targetUids).map(uid => 
        addDoc(collection(db, 'notifications'), {
          uid,
          title: `🚨 [긴급 SOS] ${type} 발생!`,
          message: `${profile.displayName}님이 위급 상황(${type})을 보고했습니다.`,
          type: 'EMERGENCY',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName,
          priority: 'high'
        })
      );

      await Promise.all(notificationPromises);
      
      // 실제 푸시 알림 전송 (Capacitor/브라우저 OS 레벨)
      await sendPushNotification(`🚨 [긴급 SOS] ${type} 발생!`, {
        body: `${profile.displayName}님이 위급 상황(${type})을 보고했습니다.`,
        tag: `emergency-${Date.now()}`,
        data: { type: 'EMERGENCY' }
      });

      setIsSOSDialogOpen(false);
      toast.error('긴급 SOS 전송 완료');
    } catch (error) {
      toast.error('SOS 전송 실패');
    } finally {
      setIsSOSLoading(false);
    }
  };

  const safeTrim = (v: unknown) => (v == null ? '' : String(v)).trim();
  const safeLower = (v: unknown) => safeTrim(v).toLowerCase();

  const isExcludedRole = profile && (
    ['EMPLOYEE', 'WORKER'].includes(safeTrim(profile.role).toUpperCase()) || 
    (['조장', '반장', '사원'].includes(safeTrim(profile.position)) && profile.role !== 'TEAM_LEADER') ||
    safeLower(profile.employeeId).includes('x66626') ||
    safeLower(profile.displayName).includes('x66626') ||
    safeLower(profile.email).includes('x66626') ||
    safeLower(user?.email).includes('x66626') ||
    safeLower(user?.email).split('@')[0] === 'x66626' ||
    safeLower(user?.email).startsWith('x66626@') ||
    safeLower(user?.displayName).includes('x66626')
  );

  const isAdmin = profile && !isExcludedRole && (['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'SAFETY_MANAGER'].includes(profile.role) || profile.permissions?.includes('admin'));
  const canSeePersonnel = profile && !isExcludedRole && (['CEO', 'DIRECTOR', 'GENERAL_MANAGER'].includes(profile.role) || profile.permissions?.includes('employee_mgmt'));

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '홈' },
    { to: '/attendance', icon: Clock, label: '근태' },
    { to: '/personal-work-log', icon: ClipboardList, label: '일지' },
    isAdmin && { to: '/admin', icon: Settings, label: '관리' },
    { to: '/mypage', icon: User, label: '내정보' },
  ].filter(Boolean) as any[];

  const isHome = location.pathname === '/';

  const sosDialogModal = (
    <Dialog open={isSOSDialogOpen} onOpenChange={setIsSOSDialogOpen}>
      <DialogTrigger 
        className="h-9 px-3 bg-rose-600 hover:bg-rose-700 rounded-full flex items-center justify-center gap-1 text-white active:scale-95 transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
      >
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span className="text-xs font-black whitespace-nowrap">긴급호출</span>
      </DialogTrigger>
      <DialogContent className="bg-card border border-border rounded-3xl p-0 overflow-hidden max-w-[300px]">
        <div className="bg-rose-600 p-5 text-center text-white">
          <h2 className="text-lg font-black">긴급 상황 전송</h2>
          <p className="text-[11px] font-bold text-white/90 mt-1">유형을 선택하면 관리자에게 즉시 알림이 전송됩니다</p>
        </div>
        <div className="p-3.5 grid grid-cols-2 gap-2">
          {['화재', '추락', '협착', '기타'].map(type => (
            <button 
              key={type}
              onClick={() => handleEmergencySOS(type)}
              disabled={isSOSLoading}
              className="h-18 bg-muted rounded-2xl flex flex-col items-center justify-center gap-1 font-black text-xs border border-border active:scale-95 transition-all hover:bg-muted/80 cursor-pointer"
            >
              <span className="text-xl">{type === '화재' ? '🔥' : type === '추락' ? '🧗' : type === '협착' ? '🏗️' : '🆘'}</span>
              <span className="text-foreground">{type}</span>
            </button>
          ))}
        </div>
        <div className="p-3 pt-0">
          <Button variant="ghost" className="w-full text-muted-foreground font-black text-xs h-9 rounded-xl" onClick={() => setIsSOSDialogOpen(false)}>취소</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col h-screen bg-background font-sans text-foreground select-none">
      {!isHome && (
        <header
          className={cn(
            "h-14 backdrop-blur-xl border-b flex items-center justify-center flex-shrink-0 sticky top-0 z-50 transition-colors",
            lightTheme && !highContrast
              ? "bg-white/92 border-slate-200/80 shadow-[0_4px_16px_rgba(15,23,42,0.04)]"
              : "bg-card/90 border-border/50 shadow-xs"
          )}
        >
          <div className="w-full max-w-2xl px-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="w-9 h-9 -ml-1.5 text-muted-foreground hover:text-foreground transition-all rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Link to="/" className="flex items-center gap-2 group">
                <div className={cn(
                  "w-7 h-7 rounded-xl border flex items-center justify-center p-1 active:scale-95 transition-all",
                  lightTheme && !highContrast
                    ? "bg-[#EFF6FF] border-blue-200/70"
                    : "bg-primary/10 border-primary/20"
                )}>
                  <CompanyLogo className="w-full h-full" />
                </div>
                <span className="font-black text-sm tracking-tight leading-none text-foreground whitespace-nowrap">
                  건명기업
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "w-9 h-9 text-foreground/80 hover:text-foreground transition-all rounded-full relative z-10",
                    lightTheme && !highContrast ? "bg-slate-100/90 hover:bg-slate-200/80" : "bg-muted/60 hover:bg-muted"
                  )}
                  onClick={() => navigate('/notifications')}
                >
                  <Bell className="w-4.5 h-4.5" />
                </Button>
                {unreadCount > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 rounded-full border border-background flex items-center justify-center z-20">
                    <span className="text-[9px] font-black text-white leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  </div>
                )}
              </div>

              {sosDialogModal}
            </div>
          </div>
        </header>
      )}

      <main ref={mainRef} className="flex-1 overflow-y-auto bg-background relative overflow-x-hidden">
        <div className="w-full max-w-2xl mx-auto pb-24 relative z-10 animate-fade-in">
          {/* Home route floating top-right Bell + SOS overlaid directly onto 3D Shipyard Hero */}
          {isHome && (
            <div className="absolute top-4 right-4 z-40 flex items-center gap-1.5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => navigate('/notifications')}
                  className={cn(
                    "w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/25 text-white flex items-center justify-center relative cursor-pointer hover:bg-black/55 transition-all",
                    hasImportantNotice && "ring-2 ring-rose-500 bg-rose-600/70"
                  )}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
              {sosDialogModal}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Floating Pill Capsule Bottom Dock (Concept 1 3D Marine) */}
      <div className="fixed bottom-3 left-3 right-3 z-50 flex justify-center pointer-events-none pb-safe">
        <nav
          className={cn(
            "pointer-events-auto w-full max-w-md h-[60px] backdrop-blur-xl border rounded-full flex items-center justify-around px-3",
            lightTheme && !highContrast
              ? "bg-white/95 border-slate-200/85 shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
              : "bg-card/95 border-border/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
          )}
        >
          {navItems.map((item) => (
            <NavItem 
              key={item.to} 
              to={item.to} 
              icon={item.icon} 
              label={item.label} 
              active={location.pathname === item.to} 
            />
          ))}
        </nav>
      </div>
      <CriticalIncidentAlertCenter />
    </div>
  );
};
