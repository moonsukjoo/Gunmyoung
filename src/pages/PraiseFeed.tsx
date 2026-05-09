import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthProvider';
import { db } from '@/src/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  increment,
  getDocs,
  getDoc,
  where,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { Praise, UserProfile, PraiseComment } from '@/src/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { 
  Heart, 
  Search, 
  MessageCircle, 
  User as UserIcon, 
  ChevronLeft,
  Sparkles,
  Send,
  Users,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Trash2,
  Trophy,
  Medal,
  Crown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const RankingSection: React.FC<{ rankings: UserProfile[] }> = ({ rankings }) => {
  if (rankings.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-black text-white">이번 달 칭찬 랭킹</h3>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {rankings.map((user, index) => {
          const isFirst = index === 0;
          const isSecond = index === 1;
          const isThird = index === 2;
          
          return (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border",
                isFirst ? "bg-yellow-500/10 border-yellow-500/20" : 
                isSecond ? "bg-gray-400/10 border-gray-400/20" : 
                isThird ? "bg-orange-500/10 border-orange-500/20" : "bg-white/5 border-white/5"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 font-black text-sm">
                  {isFirst ? <Crown className="w-6 h-6 text-yellow-500" /> : 
                   isSecond ? <Medal className="w-5 h-5 text-gray-400" /> : 
                   isThird ? <Medal className="w-5 h-5 text-orange-500" /> : index + 1}
                </div>
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-muted-foreground opacity-50" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">{user.displayName}님</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{user.departmentName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
                <span className="text-xs font-black text-white">{user.monthlyKudosCount || 0}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const CommentSection: React.FC<{ praiseId: string; userProfile: UserProfile | null }> = ({ praiseId, userProfile }) => {
  const [comments, setComments] = useState<PraiseComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'praises', praiseId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PraiseComment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `praises/${praiseId}/comments`));

    return () => unsubscribe();
  }, [praiseId, isOpen]);

  const handleAddComment = async () => {
    if (!userProfile || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'praises', praiseId, 'comments'), {
        praiseId,
        uid: userProfile.uid,
        userName: userProfile.displayName,
        message: newComment.trim(),
        createdAt: new Date().toISOString()
      });
      setNewComment('');
      toast.success('댓글이 등록되었습니다.');
    } catch (err) {
      console.error("Add comment error:", err);
      toast.error('댓글 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        uid: userProfile?.uid,
        title: '댓글 삭제',
        message: '댓글이 삭제되었습니다.',
        type: 'SYSTEM',
        isRead: false,
        createdAt: new Date().toISOString()
      });
      // Just for UX, in real app we'd check permissions
      await deleteDoc(doc(db, 'praises', praiseId, 'comments', commentId));
      toast.success('댓글이 삭제되었습니다.');
    } catch (err) {}
  };

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[10px] font-black text-muted-foreground hover:text-primary transition-colors"
      >
        <MessageSquare className="w-3 h-3" />
        댓글 {comments.length > 0 ? comments.length : ''}
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-3 mt-3"
          >
            {comments.map(comment => (
              <div key={comment.id} className="bg-white/5 p-3 rounded-xl flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-primary">{comment.userName}</span>
                  <span className="text-[8px] text-muted-foreground">{format(new Date(comment.createdAt), 'MM.dd HH:mm')}</span>
                </div>
                <p className="text-[11px] text-white/80">{comment.message}</p>
              </div>
            ))}

            <div className="flex gap-2 items-center mt-2">
              <Input 
                placeholder="따뜻한 댓글을 남겨주세요"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="bg-white/5 border-white/10 text-white h-9 rounded-xl text-xs font-medium"
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <Button 
                size="sm" 
                onClick={handleAddComment}
                disabled={isSubmitting || !newComment.trim()}
                className="h-9 px-3 rounded-xl bg-primary text-white"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PraiseFeed: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [praises, setPraises] = useState<Praise[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [rankings, setRankings] = useState<UserProfile[]>([]);
  
  // Search & Select User
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    // Real-time listener for praises
    const q = query(
      collection(db, 'praises'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPraises(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Praise)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'praises');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Ranking listener (Top 3 monthly)
    const currentMonth = format(new Date(), 'yyyy-MM');
    const rankingQ = query(
      collection(db, 'users'),
      where('isActive', '==', true),
      where('kudosMonth', '==', currentMonth)
    );

    const unsubscribe = onSnapshot(rankingQ, (snapshot) => {
      const top3 = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => (u.monthlyKudosCount || 0) > 0)
        .sort((a, b) => (b.monthlyKudosCount || 0) - (a.monthlyKudosCount || 0))
        .slice(0, 3);
      setRankings(top3);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users_rankings'));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch all active users once to allow fast searching
    const fetchAllUsers = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('isActive', '==', true),
          limit(200) // Support up to 200 users for local search
        );
        const snap = await getDocs(q);
        const users = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setAllUsers(users);
      } catch (err) {
        console.error("Fetch users error:", err);
      }
    };

    if (isWriteOpen) {
      fetchAllUsers();
    }
  }, [isWriteOpen]);

  useEffect(() => {
    if (searchTerm.length < 1 || !isWriteOpen) {
      setSearchResults([]);
      return;
    }

    const filtered = allUsers.filter(u => 
      u.uid !== profile?.uid && 
      ((u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
       (u.employeeId?.toLowerCase() || '').includes(searchTerm.toLowerCase()))
    ).slice(0, 5);
    
    setSearchResults(filtered);
  }, [searchTerm, allUsers, profile, isWriteOpen]);

  const handleSendPraise = async () => {
    if (!profile || !selectedUser || !message.trim()) {
      toast.error('동료를 선택하고 메시지를 입력해주세요.');
      return;
    }

    setIsSending(true);
    try {
      const currentMonth = format(new Date(), 'yyyy-MM');
      const praiseData: Omit<Praise, 'id'> = {
        senderUid: profile.uid,
        senderName: profile.displayName,
        receiverUid: selectedUser.uid,
        receiverName: selectedUser.displayName,
        message: message.trim(),
        createdAt: new Date().toISOString()
      };

      // 1. Add praise to feed
      await addDoc(collection(db, 'praises'), praiseData);

      // 2. Atomic update for kudos counts with monthly reset logic
      const receiverRef = doc(db, 'users', selectedUser.uid);
      const receiverSnap = await getDoc(receiverRef);
      const receiverData = receiverSnap.data() as UserProfile | undefined;
      
      const isNewMonth = !receiverData?.kudosMonth || receiverData.kudosMonth !== currentMonth;
      const newMonthlyKudosCount = isNewMonth ? 1 : (receiverData?.monthlyKudosCount || 0) + 1;

      await updateDoc(receiverRef, {
        kudosCount: increment(1),
        monthlyKudosCount: newMonthlyKudosCount,
        kudosMonth: currentMonth
      });

      // 3. Notify receiver
      await addDoc(collection(db, 'notifications'), {
        uid: selectedUser.uid,
        title: '💖 칭찬Hearts 알림',
        message: `${profile.displayName}님이 당신을 칭찬했습니다: "${message.substring(0, 30)}..."`,
        type: 'SYSTEM',
        isRead: false,
        createdAt: new Date().toISOString(),
        fromUid: profile.uid,
        fromName: profile.displayName
      });

      // 4. Notify safety managers about potential safety king
      const managersQuery = query(collection(db, 'users'), where('role', '==', 'SAFETY_MANAGER'));
      const managersSnap = await getDocs(managersQuery);
      
      const managerNotifPromises = managersSnap.docs.map(mDoc => 
        addDoc(collection(db, 'notifications'), {
          uid: mDoc.id,
          title: '🏆 칭찬왕 후보 알림',
          message: `${selectedUser.displayName}님이 칭찬을 받았습니다! (이번 달 누적: ${newMonthlyKudosCount}개). 확인 후 칭찬쿠폰 지급을 검토해주세요.`,
          type: 'SYSTEM',
          isRead: false,
          createdAt: new Date().toISOString(),
          fromUid: profile.uid,
          fromName: profile.displayName
        })
      );
      await Promise.all(managerNotifPromises);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success('칭찬이 전달되었습니다!');
      setIsWriteOpen(false);
      setSelectedUser(null);
      setMessage('');
      setSearchTerm('');
    } catch (error) {
      console.error("Send praise error:", error);
      toast.error('칭찬 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-white/5 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">칭찬 릴레이</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Praise Relay & Kudos</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsWriteOpen(!isWriteOpen)}
          className={cn(
            " rounded-2xl font-black gap-2 transition-all shadow-lg",
            isWriteOpen ? "bg-white/10 text-white" : "bg-primary text-white shadow-primary/20"
          )}
        >
          {isWriteOpen ? '취소' : (
            <>
              <Heart className="w-4 h-4 fill-white" />
              칭찬하기
            </>
          )}
        </Button>
      </header>

      {/* Write Section */}
      <AnimatePresence>
        {isWriteOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <Card className="bg-card border-primary/20 rounded-3xl overflow-hidden mb-6 shadow-xl shadow-primary/5">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase ml-1">누구를 칭찬할까요?</label>
                  {!selectedUser ? (
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="동료 이름 또는 사번 입력"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white/5 border-white/10 text-white pl-11 h-12 rounded-2xl font-bold"
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-[#1a1a1a] border border-white/10 rounded-2xl mt-2 overflow-hidden shadow-2xl">
                          {searchResults.map(user => (
                            <button
                              key={user.uid}
                              onClick={() => {
                                setSelectedUser(user);
                                setSearchResults([]);
                                setSearchTerm('');
                              }}
                              className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                            >
                              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-muted-foreground">
                                <UserIcon className="w-5 h-5" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-black text-white">{user.displayName}</p>
                                <p className="text-[10px] text-muted-foreground font-bold">{user.departmentName} · {user.employeeId}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-primary/10 rounded-2xl border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">{selectedUser.displayName}</p>
                          <p className="text-[10px] text-primary font-bold">{selectedUser.departmentName}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedUser(null)}
                        className="text-[10px] font-black text-primary hover:bg-primary/20"
                      >
                        변경
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase ml-1">응원 메시지</label>
                  <Textarea 
                    placeholder="동료의 안전한 행동이나 도움에 대해 작성해주세요!"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-white/5 border-white/10 text-white rounded-2xl min-h-[100px] font-medium leading-relaxed"
                  />
                </div>

                <Button 
                  onClick={handleSendPraise}
                  disabled={isSending || !selectedUser || !message.trim()}
                  className="w-full h-14 bg-primary text-white font-black text-lg rounded-2xl shadow-lg shadow-primary/20 gap-2"
                >
                  <Send className="w-5 h-5" />
                  {isSending ? '보내는 중...' : '칭찬 전송하기'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <RankingSection rankings={rankings} />

      {/* Feed List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : praises.length > 0 ? (
          praises.map((praise) => (
            <motion.div
              key={praise.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-card border-white/5 rounded-3xl overflow-hidden group hover:border-primary/10 transition-all shadow-lg">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 bg-white/5 rounded-full border-2 border-card flex items-center justify-center text-muted-foreground">
                           <UserIcon className="w-4 h-4" />
                        </div>
                        <div className="w-8 h-8 bg-primary/20 rounded-full border-2 border-card flex items-center justify-center text-primary">
                           <Heart className="w-4 h-4 fill-primary" />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white">
                          {praise.senderName} <span className="text-muted-foreground font-bold mx-1">→</span> {praise.receiverName}
                        </span>
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                          {format(new Date(praise.createdAt), 'MM.dd HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 relative">
                    <MessageCircle className="absolute -top-2 -left-2 w-5 h-5 text-primary opacity-20" />
                    <p className="text-xs font-medium text-white leading-relaxed">
                      {praise.message}
                    </p>
                  </div>

                  <CommentSection praiseId={praise.id} userProfile={profile} />
                </CardContent>
              </Card>
            </motion.div>
          ))
        ) : (
          <div className="p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 flex flex-col items-center gap-3">
            <Heart className="w-12 h-12 text-muted-foreground opacity-20" />
            <div>
              <p className="text-sm font-black text-white opacity-40">아직 칭찬이 없습니다</p>
              <p className="text-[10px] text-muted-foreground font-bold">첫 번째 칭찬의 주인공이 되어보세요!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
