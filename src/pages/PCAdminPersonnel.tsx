import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import PCAdminLayout from '../components/PCAdminLayout';
import { 
  Search, 
  Filter, 
  UserPlus, 
  MoreHorizontal, 
  Edit3, 
  Trash2, 
  Download,
  Mail,
  Phone,
  Building2,
  Calendar,
  ShieldCheck,
  UserCheck,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const PCAdminPersonnel: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phoneNumber?.includes(searchTerm);
    
    if (selectedRole === 'all') return matchesSearch;
    return matchesSearch && user.role === selectedRole;
  });

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string, color: string }> = {
      'CEO': { label: '대표이사', color: 'bg-rose-100 text-rose-700 border-rose-200' },
      'DIRECTOR': { label: '상무/이사', color: 'bg-orange-100 text-orange-700 border-orange-200' },
      'GENERAL_MANAGER': { label: '부장/현장소장', color: 'bg-amber-100 text-amber-700 border-amber-200' },
      'SAFETY_MANAGER': { label: '안전팀장', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      'TEAM_LEADER': { label: '현장관제사', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      'WORKER': { label: '작업자', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    };
    const r = roles[role] || { label: role, color: 'bg-gray-100 text-gray-700 border-gray-200' };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${r.color}`}>{r.label}</span>;
  };

  const handleUpdateRole = async (uid: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      toast.success('직책이 변경되었습니다.');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('변경 중 오류가 발생했습니다.');
    }
  };

  const handleExportExcel = () => {
    try {
      const exportData = filteredUsers.map((u, idx) => ({
        'No': idx + 1,
        '이름': u.displayName,
        '이메일': u.email || '-',
        '전화번호': u.phoneNumber || '-',
        '직책': u.role || 'WORKER',
        '부서': '건명기업 본사 / 현장 A',
        '상태': 'ACTIVE'
      }));
      import('../lib/exportUtils').then(module => {
        module.exportToExcel(exportData, `임직원목록_${new Date().toISOString().split('T')[0]}`, '임직원');
      });
      toast.success('사원정보 엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error('엑셀 변환 중 오류가 발생했습니다.');
    }
  };

  return (
    <PCAdminLayout title="임직원 정보 관리">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Top Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 w-full md:w-auto flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="이름, 이메일, 전화번호로 검색..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/10 transition-all border border-transparent focus:border-blue-100"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="all">전체 직책</option>
              <option value="CEO">대표이사</option>
              <option value="DIRECTOR">상무/이사</option>
              <option value="GENERAL_MANAGER">부장/현장소장</option>
              <option value="SAFETY_MANAGER">안전팀장</option>
              <option value="TEAM_LEADER">현장관제사</option>
              <option value="WORKER">작업자</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={handleExportExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all"
            >
              <Download className="w-4 h-4" />
              엑셀 다운로드
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
              <UserPlus className="w-4 h-4" />
              임직원 등록
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center w-16">No.</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">사용자 정보</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">직책</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">부서 / 현장</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">활성 상태</th>
                  <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="h-20 bg-slate-50/20" />
                    </tr>
                   ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400 font-bold">임직원 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => (
                    <tr key={user.uid} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="px-8 py-5 text-xs font-black text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="profile" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 leading-none mb-1.5">{user.displayName}</p>
                            <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email || '-'}</span>
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phoneNumber || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {getRoleBadge(user.role || 'WORKER')}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-tight">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          건명기업 본사 / 현장 A
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black border border-emerald-100">
                           <UserCheck className="w-3 h-3" />
                           ACTIVE
                         </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all text-slate-600" title="상세 정보">
                              <Edit3 className="w-4 h-4" />
                           </button>
                           <button className="p-2 hover:bg-rose-50 hover:shadow-md rounded-xl transition-all text-rose-500" title="삭제">
                              <Trash2 className="w-4 h-4" />
                           </button>
                           <button className="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all text-slate-400">
                              <MoreVertical className="w-4 h-4" />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-10 py-6 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center text-xs font-black text-slate-400">
             <span>총 {filteredUsers.length}명의 데이터가 파악되었습니다.</span>
             <div className="flex gap-2">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white border border-transparent hover:border-slate-200">2</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white border border-transparent hover:border-slate-200">3</button>
             </div>
          </div>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminPersonnel;
