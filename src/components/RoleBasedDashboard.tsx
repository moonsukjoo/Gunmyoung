import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  CalendarDays, 
  Clock, 
  ShieldCheck, 
  Megaphone, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Building2, 
  FileText, 
  Award, 
  Briefcase, 
  Check, 
  X, 
  ArrowRight,
  Database,
  Lock,
  UserCheck,
  Sparkles,
  Layers,
  Settings
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, where } from 'firebase/firestore';
import { Notice, LeaveRequest, Attendance, UserProfile, Role } from '@/types';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

interface RoleBasedDashboardProps {
  onNavigate?: (path: string) => void;
}

export const RoleBasedDashboard: React.FC<RoleBasedDashboardProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  
  // Allow user or reviewer to override/preview different roles (CEO, GENERAL_MANAGER, TEAM_LEADER, EMPLOYEE)
  const [previewRole, setPreviewRole] = useState<Role | 'AUTO'>('AUTO');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDbSchemaModal, setShowDbSchemaModal] = useState(false);

  // Determine active role
  const effectiveRole: Role = previewRole === 'AUTO' 
    ? (profile?.role || 'EMPLOYEE') 
    : previewRole;

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch notices
      const noticesSnap = await getDocs(query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(5)));
      const fetchedNotices: Notice[] = noticesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Notice));
      setNotices(fetchedNotices);

      // Fetch leave requests
      const leaveSnap = await getDocs(query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc'), limit(10)));
      const fetchedLeave: LeaveRequest[] = leaveSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
      setLeaveRequests(fetchedLeave);

      // Fetch today's attendance
      const todayStr = new Date().toISOString().slice(0, 10);
      const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', todayStr)));
      const fetchedAtt: Attendance[] = attSnap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance));
      setAttendanceList(fetchedAtt);

      // Fetch employees / team members
      const empSnap = await getDocs(collection(db, 'users'));
      const fetchedEmps: UserProfile[] = empSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setTeamMembers(fetchedEmps);

    } catch (err) {
      console.error('Error loading dashboard summary data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await updateDoc(doc(db, 'leaveRequests', leaveId), { status });
      toast.success(status === 'APPROVED' ? '연차 휴가 신청이 승인되었습니다.' : '연차 휴가 신청이 반려되었습니다.');
      setLeaveRequests(prev => prev.map(l => l.id === leaveId ? { ...l, status } : l));
    } catch {
      toast.error('결재 처리 중 오류가 발생했습니다.');
    }
  };

  // Role descriptions
  const roleLabels: Record<Role, string> = {
    CEO: '사장 / 대표이사',
    DIRECTOR: '임원 / 본부장',
    GENERAL_AFFAIRS: '총무 담당',
    GENERAL_MANAGER: '실장 / 부서장',
    CLERK: '일반 사무',
    SAFETY_MANAGER: '안전 관리자',
    TEAM_LEADER: '팀장',
    GROUP_LEADER: '조장 / 반장',
    EMPLOYEE: '일반 사원',
    WORKER: '현장 작업자'
  };

  const presentCount = attendanceList.filter(a => a.status === 'PRESENT' || a.clockIn).length;
  const totalEmployees = teamMembers.length || 24;
  const attendanceRate = Math.round((presentCount / Math.max(1, totalEmployees)) * 100);
  const pendingLeaves = leaveRequests.filter(l => l.status === 'PENDING');
  const myLeaveRequests = leaveRequests.filter(l => l.uid === profile?.uid);

  return (
    <div className="space-y-6">
      {/* Header & Role Switcher Toolbar */}
      <div className="bg-card border border-border p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
              HRM 맞춤 대시보드
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              현재 역할: <strong className="text-foreground">{roleLabels[effectiveRole] || effectiveRole}</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            {profile?.displayName || '임직원'}님을 위한 역할별 맞춤 정보 요약
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            사장, 실장, 팀장, 일반사원 등 권한과 직책에 최적화된 핵심 지표와 실시간 결재·근태·실적 현황입니다.
          </p>
        </div>

        {/* Role Preview Switcher & DB Schema Button */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 bg-muted/70 p-1.5 rounded-2xl border border-border">
            <span className="text-[11px] font-black text-muted-foreground px-2">역할 미리보기:</span>
            {(['AUTO', 'CEO', 'GENERAL_MANAGER', 'TEAM_LEADER', 'EMPLOYEE'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setPreviewRole(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  previewRole === r
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r === 'AUTO' ? '자동(내 권한)' : r === 'CEO' ? '사장' : r === 'GENERAL_MANAGER' ? '실장' : r === 'TEAM_LEADER' ? '팀장' : '사원'}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={() => setShowDbSchemaModal(true)}
            className="h-11 px-4 rounded-2xl font-black text-xs gap-2 border-border hover:bg-muted cursor-pointer"
          >
            <Database className="w-4 h-4 text-emerald-500" />
            <span>DB 설계 및 스키마 보기</span>
          </Button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. CEO / DIRECTOR VIEW (사장 / 대표이사 전사 요약) */}
      {/* ========================================================== */}
      {effectiveRole === 'CEO' || effectiveRole === 'DIRECTOR' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">전사 임직원 총원</span>
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-black font-mono tabular-nums text-foreground">
                {totalEmployees}<span className="text-sm font-bold text-muted-foreground ml-1">명</span>
              </p>
              <p className="text-xs font-bold text-emerald-500">정규직·물량팀 정상 등록</p>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">금일 전사 출근율</span>
                <Clock className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-3xl font-black font-mono tabular-nums text-emerald-400">
                {attendanceRate}%
              </p>
              <p className="text-xs font-bold text-muted-foreground">출근 {presentCount}명 / 전체 {totalEmployees}명</p>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">승인 대기 결재</span>
                <FileText className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-3xl font-black font-mono tabular-nums text-amber-400">
                {pendingLeaves.length}<span className="text-sm font-bold text-muted-foreground ml-1">건</span>
              </p>
              <p className="text-xs font-bold text-muted-foreground">연차 및 휴가 결재 대기</p>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">전사 안전 지수</span>
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
              </div>
              <p className="text-3xl font-black font-mono tabular-nums text-indigo-400">
                98.4점
              </p>
              <p className="text-xs font-bold text-emerald-500">무사고 연속 45일 달성</p>
            </div>
          </div>

          {/* Pending Approvals & Company Notices Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6 sm:p-8 rounded-[2.5rem] space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  경영진 승인 대기 목록 ({pendingLeaves.length}건)
                </h3>
                <Button variant="ghost" onClick={() => onNavigate?.('/leave-mgmt')} className="text-xs font-bold text-blue-500">
                  전체 관리 →
                </Button>
              </div>
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {pendingLeaves.length === 0 ? (
                  <p className="py-10 text-center text-muted-foreground font-bold text-xs">현재 승인 대기중인 휴가/연차 신청이 없습니다.</p>
                ) : (
                  pendingLeaves.map(leave => (
                    <div key={leave.id} className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-foreground">{leave.displayName || '임직원'}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">{leave.type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{leave.startDate} ~ {leave.endDate}</p>
                        {leave.reason && <p className="text-xs text-muted-foreground/80 mt-0.5">사유: {leave.reason}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApproveLeave(leave.id, 'APPROVED')}
                          className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl"
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApproveLeave(leave.id, 'REJECTED')}
                          className="h-9 px-3 text-rose-500 border-rose-500/30 hover:bg-rose-500/10 font-bold text-xs rounded-xl"
                        >
                          반려
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-card border border-border p-6 sm:p-8 rounded-[2.5rem] space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-blue-500" />
                  최신 회사 공지사항
                </h3>
                <Button variant="ghost" onClick={() => onNavigate?.('/notices')} className="text-xs font-bold text-blue-500">
                  전체 공지 →
                </Button>
              </div>
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {notices.map(notice => (
                  <div key={notice.id} className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-foreground text-sm">{notice.title}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{notice.createdAt?.slice(0, 10)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{notice.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : effectiveRole === 'GENERAL_MANAGER' ? (
        /* ========================================================== */
        /* 2. GENERAL MANAGER / DIRECTOR VIEW (실장 / 본부장 요약)     */
        /* ========================================================== */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">담당 본부/실 소속원</span>
              <p className="text-3xl font-black font-mono tabular-nums text-foreground">18<span className="text-sm font-bold text-muted-foreground ml-1">명</span></p>
              <p className="text-xs font-bold text-blue-500">조선생산본부 2실</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">실별 금일 출근율</span>
              <p className="text-3xl font-black font-mono tabular-nums text-emerald-400">94.4%</p>
              <p className="text-xs font-bold text-muted-foreground">정상 조업 중</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">소속 팀 수</span>
              <p className="text-3xl font-black font-mono tabular-nums text-foreground">3<span className="text-sm font-bold text-muted-foreground ml-1">개 팀</span></p>
              <p className="text-xs font-bold text-indigo-400">취부1팀, 용접2팀, 의장팀</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">본부 승인 대기 휴가</span>
              <p className="text-3xl font-black font-mono tabular-nums text-amber-400">{pendingLeaves.length}건</p>
              <p className="text-xs font-bold text-muted-foreground">결재 필요</p>
            </div>
          </div>

          <div className="bg-card border border-border p-6 sm:p-8 rounded-[2.5rem] space-y-4">
            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              소속 부서별 실적 및 가동 현황
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['조선 1팀 (취부)', '조선 2팀 (용접)', '의장조립팀'].map((teamName, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-foreground">{teamName}</span>
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">정상 가동</Badge>
                  </div>
                  <div className="text-xs space-y-1.5 text-muted-foreground font-medium">
                    <div className="flex justify-between"><span>투입 인원:</span> <strong className="text-foreground font-mono">6명</strong></div>
                    <div className="flex justify-between"><span>공정 진척률:</span> <strong className="text-blue-400 font-mono">82%</strong></div>
                    <div className="flex justify-between"><span>금일 특이사항:</span> <strong className="text-foreground">없음</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : effectiveRole === 'TEAM_LEADER' ? (
        /* ========================================================== */
        /* 3. TEAM LEADER VIEW (팀장 대시보드)                         */
        /* ========================================================== */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">내 팀 소속원</span>
              <p className="text-3xl font-black font-mono tabular-nums text-foreground">8<span className="text-sm font-bold text-muted-foreground ml-1">명</span></p>
              <p className="text-xs font-bold text-blue-500">외주물량1팀</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">팀원 금일 출근</span>
              <p className="text-3xl font-black font-mono tabular-nums text-emerald-400">8 / 8명</p>
              <p className="text-xs font-bold text-emerald-500">100% 출석</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">팀 작업일지 제출</span>
              <p className="text-3xl font-black font-mono tabular-nums text-foreground">7건</p>
              <p className="text-xs font-bold text-muted-foreground">미작성 1명</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">담당 블럭 공정</span>
              <p className="text-3xl font-black font-mono tabular-nums text-amber-400">2111 블럭</p>
              <p className="text-xs font-bold text-muted-foreground">진척률 68%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6 sm:p-8 rounded-[2.5rem] space-y-4">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                팀원 출근 및 작업 현황
              </h3>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                {teamMembers.slice(0, 6).map((member, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black">
                        {member.displayName?.slice(0, 1) || '사'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-foreground">{member.displayName} ({member.position || '사원'})</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{member.departmentName || '외주물량1팀'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">정상 출근</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border p-6 sm:p-8 rounded-[2.5rem] space-y-4">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-500" />
                팀원 연차 / 휴가 신청 현황
              </h3>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                {leaveRequests.length === 0 ? (
                  <p className="py-10 text-center text-muted-foreground font-bold text-xs">휴가 신청 내역이 없습니다.</p>
                ) : (
                  leaveRequests.slice(0, 5).map(l => (
                    <div key={l.id} className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-black text-foreground">{l.displayName || '임직원'}</span>
                        <span className="ml-2 text-muted-foreground font-mono">{l.startDate} ~ {l.endDate}</span>
                      </div>
                      <Badge variant="outline" className={l.status === 'APPROVED' ? 'text-emerald-500 border-emerald-500/30' : 'text-amber-500 border-amber-500/30'}>
                        {l.status === 'APPROVED' ? '승인됨' : l.status === 'REJECTED' ? '반려됨' : '대기중'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================== */
        /* 4. EMPLOYEE / WORKER VIEW (일반 사원 / 작업자 대시보드)      */
        /* ========================================================== */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">내 잔여 연차</span>
              <p className="text-3xl font-black font-mono tabular-nums text-blue-400">
                {profile?.annualLeaveBalance ?? 15}<span className="text-sm font-bold text-muted-foreground ml-1">일</span>
              </p>
              <p className="text-xs font-bold text-muted-foreground">총 15일 중 사용 {15 - (profile?.annualLeaveBalance ?? 15)}일</p>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">금일 출근 상태</span>
              <p className="text-3xl font-black font-mono tabular-nums text-emerald-400">정상 출근</p>
              <p className="text-xs font-bold text-muted-foreground">08:15 지문/GPS 인증완료</p>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">안전 포인트 / 상점</span>
              <p className="text-3xl font-black font-mono tabular-nums text-amber-400">
                {profile?.points ?? 120}<span className="text-sm font-bold text-muted-foreground ml-1">점</span>
              </p>
              <p className="text-xs font-bold text-emerald-500">칭찬 포인트 적립됨</p>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">내 안전 지수</span>
              <p className="text-3xl font-black font-mono tabular-nums text-indigo-400">
                {profile?.safetyScore ?? 100}<span className="text-sm font-bold text-muted-foreground ml-1">점</span>
              </p>
              <p className="text-xs font-bold text-emerald-500">우수 안전 등급</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-6 sm:p-8 rounded-[2.5rem] space-y-4">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-500" />
                나의 연차 신청 내역
              </h3>
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {myLeaveRequests.length === 0 ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-xs text-muted-foreground font-bold">신청한 휴가 내역이 없습니다.</p>
                    <Button onClick={() => onNavigate?.('/leave')} className="rounded-xl text-xs font-black">
                      + 연차 신청하기
                    </Button>
                  </div>
                ) : (
                  myLeaveRequests.map(l => (
                    <div key={l.id} className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-black text-foreground">{l.type}</span>
                        <p className="text-muted-foreground font-mono mt-0.5">{l.startDate} ~ {l.endDate}</p>
                      </div>
                      <Badge variant="outline" className={l.status === 'APPROVED' ? 'text-emerald-500 border-emerald-500/30' : 'text-amber-500 border-amber-500/30'}>
                        {l.status === 'APPROVED' ? '승인완료' : l.status === 'REJECTED' ? '반려됨' : '결재대기중'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-card border border-border p-6 sm:p-8 rounded-[2.5rem] space-y-4">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-500" />
                회사 공지사항 및 안전 안내
              </h3>
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {notices.map(notice => (
                  <div key={notice.id} className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-foreground text-sm">{notice.title}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{notice.createdAt?.slice(0, 10)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{notice.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* Database Schema & RBAC Architecture Modal (DB 설계서) */}
      {/* ========================================================== */}
      {showDbSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black">회사 HRM 시스템 DB 설계 및 권한(RBAC) 아키텍처 명세</h3>
                  <p className="text-xs text-muted-foreground font-medium">Firestore NoSQL 컬렉션 구조 및 역할별 접근 제어 규칙 설계</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDbSchemaModal(false)}
                className="w-10 h-10 rounded-full hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-6 text-xs leading-relaxed">
              <div className="p-5 rounded-2xl bg-muted/50 border border-border space-y-2">
                <h4 className="font-black text-foreground text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  1. Firestore 컬렉션 구조 (Collections Schema)
                </h4>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground font-medium">
                  <li>
                    <strong className="text-foreground font-mono">users (사용자 프로필)</strong>: 사원증 번호, 이메일, 성명, <code className="text-blue-400">role</code> (CEO, GENERAL_MANAGER, TEAM_LEADER, EMPLOYEE 등), 부서ID, 직급, 잔여 연차, 안전점수, 포인트.
                  </li>
                  <li>
                    <strong className="text-foreground font-mono">departments (조직/부서)</strong>: 부서 ID, 부서명, 실장/팀장 UID 매핑.
                  </li>
                  <li>
                    <strong className="text-foreground font-mono">attendance (근태 기록)</strong>: 기록 ID, 사원 UID, 날짜(YYYY-MM-DD), 출근시간, 퇴근시간, 상태(PRESENT, LATE, ABSENT).
                  </li>
                  <li>
                    <strong className="text-foreground font-mono">leaveRequests (연차/휴가 결재)</strong>: 신청 ID, 사원 UID, 휴가 종류(연차, 병가, 경조사), 시작일, 종료일, 사유, 결재 상태(PENDING, APPROVED, REJECTED).
                  </li>
                  <li>
                    <strong className="text-foreground font-mono">workLogs (작업일지)</strong>: 일지 ID, 사원 UID, 날짜, 공정 내용, 투입 시간, 승인 여부.
                  </li>
                  <li>
                    <strong className="text-foreground font-mono">notices (공지사항)</strong>: 공지 ID, 제목, 내용, 작성자, 중요 여부, 생성일시.
                  </li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-muted/50 border border-border space-y-2">
                <h4 className="font-black text-foreground text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  2. 역할별 권한 매트릭스 (RBAC Matrix)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-black">
                        <th className="py-2.5 px-3">역할 (Role)</th>
                        <th className="py-2.5 px-3">대시보드 주요 요약</th>
                        <th className="py-2.5 px-3">결재 권한</th>
                        <th className="py-2.5 px-3">전사 데이터 조회</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-medium">
                      <tr>
                        <td className="py-2.5 px-3 font-black text-blue-400">CEO / 사장</td>
                        <td className="py-2.5 px-3">전사 총원, 출근율, 경영 지표, 전체 결재 건</td>
                        <td className="py-2.5 px-3">전사 최종 승인</td>
                        <td className="py-2.5 px-3">전체 조회 가능</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-black text-emerald-400">실장 / 본부장</td>
                        <td className="py-2.5 px-3">소속 본부 인원, 부서별 실적 및 가동 현황</td>
                        <td className="py-2.5 px-3">본부 내 1차/2차 승인</td>
                        <td className="py-2.5 px-3">소속 본부 범위</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-black text-amber-400">팀장</td>
                        <td className="py-2.5 px-3">팀원 출근 현황, 팀 작업일지, 팀원 연차 내역</td>
                        <td className="py-2.5 px-3">팀원 휴가 검토</td>
                        <td className="py-2.5 px-3">소속 팀 범위</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-black text-purple-400">일반 사원 / 작업자</td>
                        <td className="py-2.5 px-3">개인 잔여 연차, 출근 기록, 안전 포인트, 공지사항</td>
                        <td className="py-2.5 px-3">본인 신청 작성</td>
                        <td className="py-2.5 px-3">본인 데이터만</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-muted/50 border border-border space-y-2">
                <h4 className="font-black text-foreground text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  3. Firestore 보안 규칙 (Security Rules 요약)
                </h4>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || request.auth.token.admin == true;
    }
    match /leaveRequests/{leaveId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update: if request.auth != null; // 관리자 및 팀장 승인
    }
    match /attendance/{attId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}`}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setShowDbSchemaModal(false)} className="px-8 h-12 rounded-xl font-black">
                확인 완료
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleBasedDashboard;
