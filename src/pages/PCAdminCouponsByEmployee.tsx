import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Search, 
  Plus, 
  Gift, 
  Ticket, 
  Calendar, 
  User, 
  ChevronRight,
  Filter,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  MapPin,
  Clock as ClockIcon,
  Download,
  Users,
  Award,
  Coins,
  Save
} from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { UserProfile, PraiseCoupon } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import {
  formatPointsDisplay,
  pointsToKrw,
  saveDailyAttendanceRewardKrw,
  useAttendanceRewardSettings,
  KRW_PER_POINT,
} from '../services/attendancePointService';

const PCAdminCouponsByEmployee: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [coupons, setCoupons] = useState<PraiseCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Coupon Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<PraiseCoupon | null>(null);
  const [editPoints, setEditPoints] = useState(1);
  const [editLocation, setEditLocation] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  // Add Coupon Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addPoints, setAddPoints] = useState(1);
  const [addLocation, setAddLocation] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [addTime, setAddTime] = useState(new Date().toTimeString().slice(0, 5));

  // Direct Point Edit Modal State
  const [isDirectPointModalOpen, setIsDirectPointModalOpen] = useState(false);
  const [directPointsInput, setDirectPointsInput] = useState<number>(0);

  // Daily Attendance Praise Point Setting State (Firestore synced)
  const rewardMeta = useAttendanceRewardSettings();
  const [dailyRewardInput, setDailyRewardInput] = useState<string>(
    String(rewardMeta.dailyAttendanceRewardKrw)
  );
  const [savingDailyReward, setSavingDailyReward] = useState(false);

  useEffect(() => {
    setDailyRewardInput(String(rewardMeta.dailyAttendanceRewardKrw));
  }, [rewardMeta.dailyAttendanceRewardKrw]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setUsers(usersList);

      const couponsSnap = await getDocs(collection(db, 'praiseCoupons'));
      const couponsList = couponsSnap.docs.map(d => ({ ...d.data(), id: d.id } as PraiseCoupon));
      setCoupons(couponsList);

      // Keep selectedUser updated if already selected
      setSelectedUser(prev => {
        if (!prev) return null;
        const updated = usersList.find(u => u.uid === prev.uid);
        return updated || prev;
      });
    } catch (e) {
      console.error(e);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Robust user resolver for coupons (matching by uid, employeeId, or receiverName)
  const resolveUserForCoupon = (c: PraiseCoupon) => {
    return users.find(u => 
      u.uid === c.receiverUid || 
      u.employeeId === c.receiverUid || 
      u.displayName === c.receiverName
    );
  };

  // Filtered employees based on search query
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      (u.displayName?.toLowerCase() || '').includes(q) ||
      (u.employeeId?.toLowerCase() || '').includes(q) ||
      (u.departmentName?.toLowerCase() || '').includes(q) ||
      (u.position?.toLowerCase() || '').includes(q)
    );
  });

  // Coupons for selected user
  const selectedUserCoupons = selectedUser 
    ? coupons.filter(c => {
        const u = resolveUserForCoupon(c);
        return u?.uid === selectedUser.uid || c.receiverUid === selectedUser.uid || c.receiverName === selectedUser.displayName;
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const totalPointsForSelected = selectedUserCoupons.reduce((acc, c) => acc + (Number(c.points) || 0), 0);

  const handleOpenEdit = (coupon: PraiseCoupon) => {
    setEditingCoupon(coupon);
    setEditPoints(coupon.points || 1);
    setEditLocation(coupon.location || '');
    setEditReason(coupon.reason || '');
    setEditDate(coupon.date || new Date().toISOString().split('T')[0]);
    setEditTime(coupon.time || '12:00');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon || !selectedUser) return;

    try {
      const oldPoints = Number(editingCoupon.points) || 0;
      const newPoints = Number(editPoints) || 0;
      const pointsDiff = newPoints - oldPoints;

      await updateDoc(doc(db, 'praiseCoupons', editingCoupon.id), {
        points: newPoints,
        location: editLocation.trim(),
        reason: editReason.trim(),
        date: editDate,
        time: editTime,
        updatedAt: new Date().toISOString()
      });

      if (pointsDiff !== 0) {
        await updateDoc(doc(db, 'users', selectedUser.uid), {
          points: increment(pointsDiff)
        });
      }

      toast.success('칭찬쿠폰 내역이 수정되었습니다.');
      setIsEditModalOpen(false);
      setEditingCoupon(null);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteCoupon = async (coupon: PraiseCoupon) => {
    if (!selectedUser) return;
    if (!window.confirm(`정말로 이 칭찬쿠폰 내역을 삭제하시겠습니까?\n삭제 시 해당 직원의 포인트에서 ${coupon.points || 0}P가 차감됩니다.`)) return;

    try {
      await deleteDoc(doc(db, 'praiseCoupons', coupon.id));
      const pts = Number(coupon.points) || 0;
      if (pts > 0) {
        await updateDoc(doc(db, 'users', selectedUser.uid), {
          points: increment(-pts)
        });
      }
      toast.success('칭찬쿠폰이 삭제되었습니다.');
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!addReason.trim() || !addLocation.trim()) {
      toast.error('장소와 사유를 모두 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'praiseCoupons'), {
        receiverUid: selectedUser.uid,
        receiverName: selectedUser.displayName,
        receiverDept: selectedUser.departmentName || '현장',
        senderUid: profile?.uid || 'admin',
        senderName: profile?.displayName || '관리자',
        senderRole: profile?.role || 'CEO',
        points: Number(addPoints),
        location: addLocation.trim(),
        reason: addReason.trim(),
        date: addDate,
        time: addTime,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'users', selectedUser.uid), {
        points: increment(Number(addPoints))
      });

      // Send notification
      await addDoc(collection(db, 'notifications'), {
        uid: selectedUser.uid,
        title: `🏆 관리자에 의해 칭찬쿠폰(+${addPoints}P)이 지급되었습니다!`,
        message: `사유: ${addReason.trim()}`,
        type: 'PRAISE_COUPON',
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success(`${selectedUser.displayName} 님에게 칭찬쿠폰(${addPoints}P)이 지급되었습니다.`);
      setIsAddModalOpen(false);
      setAddReason('');
      setAddLocation('');
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('쿠폰 지급 중 오류가 발생했습니다.');
    }
  };

  const handleSaveDirectPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const newPoints = Number(directPointsInput);
    if (isNaN(newPoints) || newPoints < 0) {
      toast.error('올바른 포인트를 입력해주세요.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        points: newPoints,
        updatedAt: new Date().toISOString()
      });
      toast.success(`${selectedUser.displayName} 님의 보유 포인트가 ${newPoints}P(${pointsToKrw(newPoints).toLocaleString()}원)로 직접 수정되었습니다.`);
      setIsDirectPointModalOpen(false);
      setSelectedUser(prev => prev ? { ...prev, points: newPoints } : null);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('포인트 직접 수정 중 오류가 발생했습니다.');
    }
  };

  const handleSaveDailyRewardSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(dailyRewardInput);
    if (!Number.isFinite(num) || num < 0 || num > 100000) {
      toast.error('0원 이상 100,000원 이하의 금액을 입력해주세요.');
      return;
    }
    setSavingDailyReward(true);
    try {
      const saved = await saveDailyAttendanceRewardKrw(
        num,
        profile?.uid,
        profile?.displayName || '관리자'
      );
      toast.success(
        `출근 시 칭찬포인트가 ${saved.toLocaleString()}원(${(saved / KRW_PER_POINT).toFixed(4)}P)으로 즉시 변경되었습니다.`
      );
    } catch (err) {
      console.error(err);
      toast.error('출근 포인트 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingDailyReward(false);
    }
  };

  return (
    <PCAdminLayout title="사원별 칭찬쿠폰 및 포인트 관리">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-8 text-foreground pb-20 space-y-6">
        {/* Global Daily Attendance Reward Settings Bar (Firestore synced) */}
        <form
          onSubmit={handleSaveDailyRewardSetting}
          className="bg-card border border-border rounded-[2rem] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-foreground">
                  출근 시 자동 지급 칭찬포인트 설정 (실시간 적용)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-black">
                  현재 {rewardMeta.dailyAttendanceRewardKrw.toLocaleString()}원/일
                </span>
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-0.5">
                변경 저장 즉시 재빌드 없이 모든 직원 앱의 출근 적립 금액과 화면 문구가 바뀝니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {[10, 30, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDailyRewardInput(String(preset))}
                className={`px-3 py-2 rounded-xl text-xs font-black border cursor-pointer transition-all ${
                  Number(dailyRewardInput) === preset
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-muted/60 text-foreground border-border hover:border-amber-500/50'
                }`}
              >
                {preset}원
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100000}
                step={1}
                value={dailyRewardInput}
                onChange={(e) => setDailyRewardInput(e.target.value)}
                className="w-24 h-10 px-3 rounded-xl bg-muted border border-border font-black text-sm text-foreground"
              />
              <span className="text-xs font-black text-muted-foreground">원</span>
            </div>
            <Button
              type="submit"
              disabled={savingDailyReward}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingDailyReward ? '저장 중...' : '즉시 적용'}
            </Button>
          </div>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Employee List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              임직원 목록
            </h3>
            <span className="px-3 py-1 text-xs font-bold border border-border bg-muted text-foreground rounded-full">
              총 {users.length}명
            </span>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="사원명, 사번, 부서 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[calc(100vh-320px)] pr-2 scrollbar-hide">
            {loading ? (
              <div className="py-20 text-center bg-card rounded-3xl border border-border">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-muted-foreground font-bold text-xs">사원 목록 로딩 중...</p>
              </div>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map(user => {
                const uCoupons = coupons.filter(c => {
                  const matchedU = resolveUserForCoupon(c);
                  return matchedU?.uid === user.uid || c.receiverUid === user.uid || c.receiverName === user.displayName;
                });
                const uPoints = Number(user.points ?? uCoupons.reduce((acc, c) => acc + (Number(c.points) || 0), 0));
                const isSelected = selectedUser?.uid === user.uid;

                return (
                  <div
                    key={user.uid}
                    onClick={() => setSelectedUser(user)}
                    className={`p-5 rounded-3xl cursor-pointer transition-all border-2 flex items-center justify-between ${
                      isSelected 
                        ? 'border-primary bg-primary/10 shadow-md' 
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center font-black text-foreground shrink-0 border border-border">
                        {user.displayName?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-foreground text-base truncate">{user.displayName}</h4>
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                            {user.position || user.role || '사원'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground mt-0.5 truncate">
                          {user.departmentName || '부서미정'} • 사번: {user.employeeId || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <div className="text-sm font-black text-emerald-500">{formatPointsDisplay(uPoints)}P</div>
                      <div className="text-[10px] font-bold text-muted-foreground">{uCoupons.length}건 수령</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center bg-card rounded-3xl border border-dashed border-border">
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-bold text-xs">검색된 사원이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Employee Coupons & Management */}
        <div className="lg:col-span-7 space-y-6">
          {selectedUser ? (
            <div className="bg-card rounded-[2.5rem] p-6 lg:p-8 border border-border shadow-sm space-y-6">
              
              {/* Employee Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-2xl">
                    {selectedUser.displayName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-foreground">{selectedUser.displayName}</h3>
                      <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                        {selectedUser.position || selectedUser.role || '사원'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground mt-1">
                      소속: {selectedUser.departmentName || '부서미정'} | 사번: {selectedUser.employeeId || '-'} | 이메일: {selectedUser.email || '-'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="text-right bg-muted px-4 py-2.5 rounded-2xl border border-border">
                    <div className="text-xs font-bold text-muted-foreground">보유 포인트</div>
                    <div className="text-lg font-black text-emerald-500">
                      {formatPointsDisplay(selectedUser.points ?? totalPointsForSelected)}P
                    </div>
                  </div>
                  
                  {/* Direct Point Edit Button */}
                  <Button 
                    onClick={() => {
                      setDirectPointsInput(Number(selectedUser.points ?? totalPointsForSelected));
                      setIsDirectPointModalOpen(true);
                    }}
                    className="h-14 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs gap-1.5 shadow-md cursor-pointer"
                  >
                    <Award className="w-4 h-4" /> 포인트 수정
                  </Button>

                  <Button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="h-14 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs gap-1.5 shadow-md cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> 쿠폰 지급
                  </Button>
                </div>
              </div>

              {/* Coupons List for Selected Employee */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Gift className="w-4 h-4 text-amber-500" />
                    받은 칭찬쿠폰 내역 ({selectedUserCoupons.length}건)
                  </h4>
                  <span className="text-xs font-bold text-muted-foreground">
                    총 환산액: {pointsToKrw(totalPointsForSelected).toLocaleString()}원
                  </span>
                </div>

                <div className="space-y-3 max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
                  {selectedUserCoupons.length > 0 ? (
                    selectedUserCoupons.map(coupon => (
                      <div 
                        key={coupon.id} 
                        className="bg-muted/50 border border-border p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted transition-all"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 font-black text-xs">
                              +{coupon.points || 1}P ({(Number(coupon.points || 1) * 5000).toLocaleString()}원)
                            </span>
                            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" /> {coupon.date || '-'} {coupon.time || ''}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" /> {coupon.location || '현장'}
                            </span>
                          </div>
                          <p className="text-xs font-black text-foreground bg-card p-3 rounded-xl border border-border/60">
                            "{coupon.reason || '사유 없음'}"
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground/80">
                            지급자: {coupon.senderName || '관리자'} ({coupon.senderRole || '관리자'})
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(coupon)}
                            className="h-10 px-3 rounded-xl font-black text-xs border-border bg-card hover:bg-muted text-foreground gap-1.5 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-500" /> 수정
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCoupon(coupon)}
                            className="h-10 px-3 rounded-xl font-black text-xs border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> 삭제
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center bg-muted/30 rounded-3xl border border-dashed border-border space-y-2">
                      <Gift className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs font-black text-muted-foreground">지급받은 칭찬쿠폰 내역이 없습니다.</p>
                      <p className="text-[11px] text-muted-foreground/60">상단의 [쿠폰 지급] 버튼으로 새로운 쿠폰을 선물하세요.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-card rounded-[2.5rem] p-16 text-center border border-border flex flex-col items-center justify-center space-y-4 min-h-[500px]">
              <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center text-muted-foreground">
                <Users className="w-10 h-10 opacity-50" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-foreground">사원을 선택해 주세요</h3>
                <p className="text-xs text-muted-foreground font-bold">왼쪽 목록에서 임직원을 선택하면 상세 칭찬쿠폰 내역과 포인트 직접 수정 권한이 나타납니다.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Direct Point Edit Modal */}
      {isDirectPointModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md space-y-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" /> {selectedUser.displayName} 포인트 직접 수정
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsDirectPointModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSaveDirectPoints} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">현재 보유 포인트</label>
                <div className="p-4 rounded-2xl bg-muted border border-border text-foreground font-black text-lg">
                  {formatPointsDisplay(selectedUser.points ?? totalPointsForSelected)}P ({pointsToKrw(selectedUser.points ?? totalPointsForSelected).toLocaleString()}원)
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">수정할 총 포인트 입력</label>
                <input 
                  type="number"
                  step="0.001"
                  value={directPointsInput}
                  onChange={(e) => setDirectPointsInput(parseFloat(e.target.value) || 0)}
                  className="w-full h-14 bg-muted border border-border rounded-2xl font-black text-lg px-4 text-foreground focus:outline-none focus:border-amber-500"
                  placeholder="예: 5"
                />
                <p className="text-[11px] font-bold text-muted-foreground">
                  환산 금액: <span className="text-emerald-500 font-black">{pointsToKrw(directPointsInput).toLocaleString()}원</span> (1P = 5,000원 기준)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDirectPointModalOpen(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-xs cursor-pointer"
                >
                  취소
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-14 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-lg shadow-amber-600/20 cursor-pointer"
                >
                  저장하기
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Coupon Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md space-y-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" /> 칭찬쿠폰 내역 수정
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">포인트 (1P = 5,000원)</label>
                <select 
                  value={editPoints}
                  onChange={(e) => setEditPoints(parseInt(e.target.value))}
                  className="w-full h-12 bg-muted border border-border rounded-xl font-black text-sm px-4 text-foreground focus:outline-none"
                >
                  {[1, 2, 3, 5, 10].map(p => (
                    <option key={p} value={p}>{p}P ({(p * 5000).toLocaleString()}원)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">일자</label>
                  <input 
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full h-12 bg-muted border border-border rounded-xl font-bold text-xs px-3 text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">시간</label>
                  <input 
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full h-12 bg-muted border border-border rounded-xl font-bold text-xs px-3 text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">장소</label>
                <input 
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="예: 제7공장 의장 안벽"
                  className="w-full h-12 bg-muted border border-border rounded-xl font-bold text-sm px-4 text-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">칭찬 사유</label>
                <textarea 
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={4}
                  className="w-full p-4 bg-muted border border-border rounded-2xl text-xs font-bold text-foreground resize-none focus:outline-none"
                  placeholder="칭찬 사유를 입력하세요"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-xs cursor-pointer"
                >
                  취소
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  저장하기
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Coupon Modal */}
      {isAddModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md space-y-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> {selectedUser.displayName} 칭찬쿠폰 지급
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleAddCoupon} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">지급 포인트 (1P = 5,000원)</label>
                <select 
                  value={addPoints}
                  onChange={(e) => setAddPoints(parseInt(e.target.value))}
                  className="w-full h-12 bg-muted border border-border rounded-xl font-black text-sm px-4 text-foreground focus:outline-none"
                >
                  {[1, 2, 3, 5, 10].map(p => (
                    <option key={p} value={p}>{p}P ({(p * 5000).toLocaleString()}원)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">일자</label>
                  <input 
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="w-full h-12 bg-muted border border-border rounded-xl font-bold text-xs px-3 text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">시간</label>
                  <input 
                    type="time"
                    value={addTime}
                    onChange={(e) => setAddTime(e.target.value)}
                    className="w-full h-12 bg-muted border border-border rounded-xl font-bold text-xs px-3 text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">장소</label>
                <input 
                  type="text"
                  value={addLocation}
                  onChange={(e) => setAddLocation(e.target.value)}
                  placeholder="예: 제7공장 의장 안벽"
                  className="w-full h-12 bg-muted border border-border rounded-xl font-bold text-sm px-4 text-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">칭찬 사유</label>
                <textarea 
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  rows={4}
                  className="w-full p-4 bg-muted border border-border rounded-2xl text-xs font-bold text-foreground resize-none focus:outline-none"
                  placeholder="사원에게 전달될 칭찬 사유를 입력하세요"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-xs cursor-pointer"
                >
                  취소
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs shadow-lg shadow-primary/20 cursor-pointer"
                >
                  지급하기
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      </div>
    </PCAdminLayout>
  );
};

export default PCAdminCouponsByEmployee;
