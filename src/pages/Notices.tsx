import React, { useEffect, useState } from 'react';
import { db } from '@/src/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Notice } from '@/src/types';
import { useAuth } from '@/src/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Megaphone, 
  Search, 
  ChevronRight, 
  Clock, 
  User,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { grantRandomShipPart } from '@/src/services/shipService';

export const Notices: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice)));
    });
    return () => unsubscribe();
  }, []);

  const filteredNotices = notices.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-2 h-6 bg-primary rounded-full" />
          <h2 className="text-3xl font-black tracking-tighter text-slate-900">공지사항</h2>
        </div>
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-8">건명기업 주요 소식 및 안내</p>
      </header>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors z-10" />
        <Input 
          placeholder="공지 내용 검색..." 
          className="h-14 pl-12 bg-white border-2 border-slate-100 focus:border-primary rounded-2xl text-base font-black shadow-sm transition-all text-slate-900 placeholder:text-slate-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Notices List */}
      <div className="grid gap-4">
        {filteredNotices.length > 0 ? filteredNotices.map((notice) => (
          <Card 
            key={notice.id} 
            className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden cursor-pointer hover:bg-slate-50/50 transition-colors border border-slate-100/50"
            onClick={() => {
              setSelectedNotice(notice);
              if (profile?.uid) {
                grantRandomShipPart(profile.uid, '공지사항 상세 확인');
              }
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {notice.isImportant && (
                      <Badge className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border-none">URGENT</Badge>
                    )}
                    <h4 className="font-black text-lg text-slate-900 tracking-tight leading-tight">{notice.title}</h4>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 font-bold leading-relaxed">{notice.content}</p>
                  
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      {format(new Date(notice.createdAt), 'yyyy.MM.dd', { locale: ko })}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <User className="w-3 h-3" />
                      {notice.authorName}
                    </div>
                  </div>
                </div>
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-200 group-hover:text-primary transition-colors self-center">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="py-20 flex flex-col items-center justify-center opacity-20 grayscale">
            <Megaphone className="w-16 h-16 mb-4" />
            <p className="font-black text-lg">검색 결과가 없습니다</p>
          </div>
        )}
      </div>

      {/* Notice Detail Dialog */}
      <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="bg-white border-none rounded-[2rem] shadow-2xl max-w-lg w-[95%] p-0 overflow-hidden">
          {selectedNotice && (
            <div className="flex flex-col">
              <div className="p-8 bg-slate-50 border-b border-slate-100 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center text-primary shadow-sm border border-slate-100">
                  <Megaphone className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  {selectedNotice.isImportant && (
                    <Badge className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest mb-1 border-none shadow-lg shadow-red-100">긴급 공지</Badge>
                  )}
                  <DialogTitle className="text-2xl font-black tracking-tighter text-slate-900 leading-tight px-4">{selectedNotice.title}</DialogTitle>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {format(new Date(selectedNotice.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                  </p>
                </div>
              </div>
              <div className="p-8 max-h-[50vh] overflow-y-auto no-scrollbar">
                <p className="text-base font-bold text-slate-700 leading-loose whitespace-pre-wrap">
                  {selectedNotice.content}
                </p>
              </div>
              <div className="p-8 pt-0 border-t border-slate-50 mt-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-xs font-black text-slate-400 uppercase">
                      {selectedNotice.authorName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">작성자</p>
                      <p className="text-sm font-black text-slate-900">{selectedNotice.authorName}</p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => setSelectedNotice(null)}
                  className="w-full h-14 bg-slate-900 text-white rounded-[1.25rem] font-black tracking-widest active:scale-95 transition-all shadow-xl shadow-slate-200"
                >
                  공지 확인 완료
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
