import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Bell, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Megaphone,
  Eye,
  Calendar,
  User,
  Filter
} from 'lucide-react';
import { collection, query, getDocs, orderBy, deleteDoc, doc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import PCAdminLayout from '../components/PCAdminLayout';
import { useAuth } from '../components/AuthProvider';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: any;
  category: string;
  priority: 'low' | 'medium' | 'high';
}

const PCAdminNotices: React.FC = () => {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('전체');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notice[];
      setNotices(data);
    } catch (e) {
      console.error(e);
      toast.error('공지사항을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }

    try {
      if (editingNotice) {
        await updateDoc(doc(db, 'notices', editingNotice.id), {
          title,
          content,
          category,
          priority,
          updatedAt: serverTimestamp()
        });
        toast.success('공지사항이 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'notices'), {
          title,
          content,
          author: profile?.displayName || '관리자',
          category,
          priority,
          createdAt: serverTimestamp()
        });
        toast.success('새 공지사항이 등록되었습니다.');
      }
      setIsModalOpen(false);
      resetForm();
      fetchNotices();
    } catch (e) {
      console.error(e);
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'notices', id));
      toast.success('공지사항이 삭제되었습니다.');
      fetchNotices();
    } catch (e) {
      console.error(e);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('전체');
    setPriority('medium');
    setEditingNotice(null);
  };

  const openEditModal = (notice: Notice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setCategory(notice.category);
    setPriority(notice.priority);
    setIsModalOpen(true);
  };

  const filteredNotices = notices.filter(notice => 
    notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notice.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'high': return <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black">긴급</span>;
      case 'medium': return <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black">일반</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black">안내</span>;
    }
  };

  return (
    <PCAdminLayout title="공지사항 관리">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Announcements</h2>
            <p className="text-slate-500 font-medium">전 직원에게 전달될 공지사항을 관리합니다.</p>
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
          >
            <Plus className="w-5 h-5" />
            새 공지사항 등록
          </button>
        </div>

        {/* Search & Filter */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input 
              type="text" 
              placeholder="제목 또는 내용으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all border border-transparent focus:border-slate-200"
            />
          </div>
          <div className="flex gap-2">
            <select className="px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-600">
              <option>모든 카테고리</option>
              <option>현장공지</option>
              <option>인사/복지</option>
              <option>안전교육</option>
              <option>기타</option>
            </select>
          </div>
        </div>

        {/* Notice List */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">상태</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">카테고리</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest w-1/2">제목</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">작성자</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">작성일</th>
                  <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-8 py-6 bg-slate-50/20" />
                    </tr>
                  ))
                ) : filteredNotices.length > 0 ? (
                  filteredNotices.map((notice) => (
                    <tr key={notice.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        {getPriorityBadge(notice.priority)}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-500">
                        {notice.category}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{notice.title}</span>
                          <span className="text-xs text-slate-400 font-medium truncate max-w-lg">{notice.content}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-200">
                             {notice.author[0]}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{notice.author}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-xs font-black text-slate-400">
                        {notice.createdAt?.toDate().toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(notice)}
                            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(notice.id)}
                            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold">
                      등록된 공지사항이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-2xl font-black tracking-tight">{editingNotice ? '공지사항 수정' : '새 공지사항 작성'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">제목</label>
                  <input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    type="text" 
                    placeholder="공지사항 제목을 입력하세요"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">카테고리</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800"
                    >
                      <option value="전체">전체공지</option>
                      <option value="현장공지">현장공지</option>
                      <option value="인사/복지">인사/복지</option>
                      <option value="안전교육">안전교육</option>
                      <option value="급여">급여안내</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">중요도</label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all border-2 ${
                            priority === p 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10 scale-105' 
                            : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'
                          }`}
                        >
                          {p === 'high' ? '긴급' : p === 'medium' ? '일반' : '상시'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">내용</label>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    placeholder="전달할 내용을 상세히 입력하세요..."
                    className="w-full px-6 py-6 bg-slate-50 border-none rounded-3xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-slate-800 resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                  >
                    {editingNotice ? '내용 수정하기' : '공지사항 게시하기'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminNotices;
