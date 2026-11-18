import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc, getDocs } from 'firebase/firestore';
import { Notice } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Megaphone, 
  Search, 
  ChevronRight, 
  Clock, 
  User,
  Trash2,
  AlertTriangle,
  Heart,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { grantRandomShipPart } from '@/services/shipService';
import { useNavigate } from 'react-router-dom';

const parseNoticeDate = (raw: any): Date | null => {
  if (!raw) return null;
  if (typeof raw?.toDate === 'function') return raw.toDate();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

export const Notices: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(5);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    isImportant: false,
    shouldNotify: true,
  });

  useEffect(() => {
    localStorage.setItem('lastViewedNoticesTime', new Date().toISOString());
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notices'));
    return () => unsubscribe();
  }, []);

  const filteredNotices = notices.filter(n => 
    (n.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateNotice = async () => {
    if (!profile) return;
    if (!newNotice.title.trim() || !newNotice.content.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedTitle = newNotice.title.trim();
      const trimmedContent = newNotice.content.trim();
      await addDoc(collection(db, 'notices'), {
        title: trimmedTitle,
        content: trimmedContent,
        isImportant: newNotice.isImportant,
        authorUid: profile.uid,
        authorName: profile.displayName || '관리자',
        createdAt: new Date().toISOString(),
        targetDept: 'ALL'
      });

      if (newNotice.shouldNotify) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const notificationPromises = usersSnap.docs.map(uDoc =>
          addDoc(collection(db, 'notifications'), {
            uid: uDoc.id,
            title: newNotice.isImportant ? `🚨 [중요공지] ${trimmedTitle}` : `📢 새 공지: ${trimmedTitle}`,
            message: trimmedContent.substring(0, 80),
            type: newNotice.isImportant ? 'URGENT_NOTICE' : 'NOTICE',
            isRead: false,
            createdAt: new Date().toISOString(),
            fromUid: profile.uid,
            fromName: profile.displayName || '관리자',
            priority: newNotice.isImportant ? 'high' : 'normal'
          })
        );
        await Promise.all(notificationPromises);
      }

      setIsCreateOpen(false);
      setNewNotice({ title: '', content: '', isImportant: false, shouldNotify: true });
      toast.success('공지사항이 등록되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notices');
      toast.error('공지사항 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notices', id));
      toast.success('공지사항이 삭제되었습니다.');
      setSelectedNotice(null);
      setIsDeleteOpen(false);
      setNoticeToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notices/${id}`);
    }
  };

  const isAdmin =
    !profile?.employeeId?.trim()?.toLowerCase()?.includes('x66626') &&
    (
      ['CEO', 'DIRECTOR', 'GENERAL_MANAGER', 'GENERAL_AFFAIRS', 'CLERK', 'SAFETY_MANAGER', 'TEAM_LEADER'].includes(profile?.role || '') ||
      profile?.permissions?.some(p => ['admin', 'notice_mgmt', 'employee_mgmt', 'leave_mgmt', 'attendance_mgmt'].includes(p)) ||
      profile?.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com'
    );

  return (
    <div className="space-y-6 pb-24 px-2">
      <header className="py-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">공지사항</h2>
          <p className="text-muted-foreground font-bold">회사 소식을 가장 빠르게 확인하세요</p>
        </div>
        {isAdmin && (
          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="h-11 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>공지 작성</span>
          </Button>
        )}
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <Input 
          placeholder="검색" 
          className="h-14 pl-11 bg-card border-border rounded-2xl text-foreground font-bold placeholder:text-muted-foreground/30"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 현장 소식 · 사고사례 · 칭찬 바로가기 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="h-10 rounded-2xl bg-primary text-primary-foreground font-black text-xs flex items-center justify-center gap-1.5 shadow-sm">
          <Megaphone className="w-3.5 h-3.5" />
          <span>공지사항</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/accidents')}
          className="h-10 rounded-2xl bg-card border border-border text-foreground hover:border-amber-500/40 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>사고사례</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/praise-feed')}
          className="h-10 rounded-2xl bg-card border border-border text-foreground hover:border-pink-500/40 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Heart className="w-3.5 h-3.5 text-pink-500" />
          <span>칭찬피드</span>
        </button>
      </div>

      <div className="space-y-2">
        {filteredNotices.length > 0 ? (
          <>
            {filteredNotices.slice(0, displayLimit).map((notice) => {
              const noticeDate = parseNoticeDate(notice.createdAt);
              return (
                <div 
                  key={notice.id} 
                  className="bg-card p-5 rounded-2xl border border-border flex items-start gap-4 cursor-pointer active:scale-[0.98] transition-all"
                  onClick={() => {
                    setSelectedNotice(notice);
                    if (profile?.uid) {
                      grantRandomShipPart(profile.uid, '공지사항 상세 확인');
                    }
                  }}
                >
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                    <Megaphone className={cn("w-5 h-5", notice.isImportant ? "text-red-500" : "text-primary")} />
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      {notice.isImportant && (
                        <Badge className="bg-red-500/20 text-red-500 border-none text-[8px] px-1.5 h-4 mb-1">URGENT</Badge>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {noticeDate ? format(noticeDate, 'MM.dd') : '-'}
                        </span>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-6 h-6 rounded-md text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoticeToDelete(notice.id);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <h4 className="text-base font-black text-foreground tracking-tight truncate">{notice.title}</h4>
                    <p className="text-xs text-muted-foreground font-bold line-clamp-1">{notice.content}</p>
                  </div>
                  <div className="flex items-center gap-1.5 self-center shrink-0">
                    <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                </div>
              );
            })}
            
            {filteredNotices.length > displayLimit && (
              <Button 
                variant="ghost" 
                className="w-full h-14 bg-muted hover:bg-muted/80 text-muted-foreground font-black rounded-2xl group transition-all"
                onClick={() => setDisplayLimit(prev => prev + 5)}
              >
                더 보기
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            )}
          </>
        ) : (
          <div className="py-20 text-center opacity-30">
            <Megaphone className="w-16 h-16 mx-auto mb-4" />
            <p className="font-black text-sm">공지사항이 없습니다</p>
          </div>
        )}
      </div>

      {/* 새 공지사항 등록 모달 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border rounded-3xl text-foreground max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" /> 새 공지사항 등록
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold">
              전체 사원에게 공지사항을 게시합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={newNotice.title}
              onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
              placeholder="공지 제목을 입력하세요"
              className="bg-muted border-border text-foreground rounded-xl h-12 font-bold"
            />
            <Textarea
              value={newNotice.content}
              onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
              placeholder="공지 내용을 입력하세요"
              className="bg-muted border-border text-foreground rounded-xl min-h-[150px] font-medium"
            />
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newNotice.isImportant}
                  onChange={(e) => setNewNotice({ ...newNotice, isImportant: e.target.checked })}
                  className="rounded bg-muted border-border"
                />
                <span className="text-xs font-bold">중요 공지</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newNotice.shouldNotify}
                  onChange={(e) => setNewNotice({ ...newNotice, shouldNotify: e.target.checked })}
                  className="rounded bg-muted border-border"
                />
                <span className="text-xs font-bold">푸시 알림 발송</span>
              </label>
            </div>
          </div>
          <DialogFooter className="flex flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="flex-1 h-12 rounded-xl font-black"
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateNotice}
              className="flex-[2] bg-primary text-primary-foreground font-black h-12 rounded-xl"
            >
              {isSubmitting ? '등록 중...' : '등록하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="bg-card border border-border rounded-3xl text-foreground max-w-[90vw] sm:max-w-md p-0 overflow-hidden">
          {selectedNotice && (
            <div className="flex flex-col">
              <div className="p-8 pb-6 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
                  <Megaphone className={cn("w-8 h-8", selectedNotice.isImportant ? "text-red-500" : "text-primary")} />
                </div>
                <div className="space-y-1">
                  {selectedNotice.isImportant && <Badge className="bg-red-500/20 text-red-500 border-none mb-1">핵심 공지</Badge>}
                  <DialogTitle className="text-xl font-black tracking-tight leading-tight text-foreground">{selectedNotice.title}</DialogTitle>
                  <div className="flex items-center justify-center gap-4 mt-2">
                     <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                       <Clock className="w-3 h-3" /> {(() => {
                         const d = parseNoticeDate(selectedNotice.createdAt);
                         return d ? format(d, 'yyyy.MM.dd HH:mm') : '-';
                       })()}
                     </span>
                     <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> {selectedNotice.authorName || (selectedNotice as any).author || '관리자'}</span>
                  </div>
                </div>
              </div>
              <div className="px-8 pb-8 max-h-[40vh] overflow-y-auto">
                <p className="text-sm font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedNotice.content}
                </p>
              </div>
              <div className="p-6 pt-0 border-t border-border space-y-3">
                <Button 
                  onClick={() => setSelectedNotice(null)}
                  className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl font-black mt-6"
                >
                  확인
                </Button>
                {isAdmin && (
                  <Button 
                    variant="ghost"
                    onClick={() => {
                      setNoticeToDelete(selectedNotice.id);
                      setIsDeleteOpen(true);
                    }}
                    className="w-full h-10 text-red-500/50 hover:text-red-500 hover:bg-red-500/5 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> 공지 삭제
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-card border border-border rounded-[2rem] shadow-2xl max-w-sm w-[90%] p-8 overflow-hidden text-foreground">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black text-foreground">공지 삭제</DialogTitle>
              <p className="text-muted-foreground font-bold text-xs">
                이 공지사항을 정말 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6">
            <Button 
              className="w-full h-14 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl"
              onClick={() => noticeToDelete && handleDeleteNotice(noticeToDelete)}
            >
              삭제하기
            </Button>
            <Button 
              variant="ghost"
              className="w-full h-10 text-muted-foreground font-black hover:text-foreground"
              onClick={() => setIsDeleteOpen(false)}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

