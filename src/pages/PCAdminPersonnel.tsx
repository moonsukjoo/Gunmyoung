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
      (user.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phoneNumber?.includes(searchTerm);
    
    if (selectedRole === 'all') return matchesSearch;
    return matchesSearch && user.role === selectedRole;
  });

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string, color: string }> = {
      'CEO': { label: '대표이사', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
      'DIRECTOR': { label: '상무/이사', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
      'GENERAL_MANAGER': { label: '부장/현장소장', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
      'SAFETY_MANAGER': { label: '안전팀장', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
      'TEAM_LEADER': { label: '현장관제사', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'WORKER': { label: '작업자', color: 'bg-muted text-muted-foreground border-border' },
    };
    const r = roles[role] || { label: role, color: 'bg-muted text-muted-foreground border-border' };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${r.color}`}>{r.label}</span>;
  };

  const getStatusBadge = (user: UserProfile) => {
    const status = user.status || (user.isActive ? 'ACTIVE' : 'RETIRED');
    
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black border border-emerald-500/20">
          <UserCheck className="w-3 h-3" />
          재직 중
        </span>
      );
    } else if (status === 'ON_LEAVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black border border-amber-500/20">
          <Calendar className="w-3 h-3" />
          휴직 중
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground rounded-lg text-[10px] font-black border border-border">
          <Trash2 className="w-3 h-3" />
          퇴직
        </span>
      );
    }
  };

  const handleUpdateStatus = async (uid: string, newStatus: string) => {
    try {
      const isActive = newStatus === 'ACTIVE' || newStatus === 'ON_LEAVE';
      await updateDoc(doc(db, 'users', uid), { 
        status: newStatus,
        isActive: isActive
      });
      toast.success('상태가 변경되었습니다.');
      fetchUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('변경 중 오류가 발생했습니다.');
    }
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
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card p-6 rounded-[2rem] shadow-sm border border-border text-foreground">
          <div className="flex items-center gap-4 w-full md:w-auto flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="이름, 이메일, 전화번호로 검색..."
                className="w-full pl-12 pr-4 py-3 bg-muted border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/10 transition-all border border-transparent focus:border-primary/20 text-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="bg-muted border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/10 cursor-pointer text-foreground"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="all" className="bg-card text-foreground">전체 직책</option>
              <option value="CEO" className="bg-card text-foreground">대표이사</option>
              <option value="DIRECTOR" className="bg-card text-foreground">상무/이사</option>
              <option value="GENERAL_MANAGER" className="bg-card text-foreground">부장/현장소장</option>
              <option value="SAFETY_MANAGER" className="bg-card text-foreground">안전팀장</option>
              <option value="TEAM_LEADER" className="bg-card text-foreground">현장관제사</option>
              <option value="WORKER" className="bg-card text-foreground">작업자</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={handleExportExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-muted border border-border rounded-2xl font-black text-sm hover:bg-muted/80 transition-all text-foreground"
            >
              <Download className="w-4 h-4" />
              엑셀 다운로드
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
              <UserPlus className="w-4 h-4" />
              임직원 등록
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden text-foreground">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-8 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center w-16">No.</th>
                  <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest">사용자 정보</th>
                  <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center">직책</th>
                  <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest">부서 / 현장</th>
                  <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center">활성 상태</th>
                  <th className="px-6 py-5 text-[11px] font-black text-muted-foreground uppercase tracking-widest text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="h-20 bg-muted/10" />
                    </tr>
                   ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-muted-foreground font-bold">임직원 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => (
                    <tr key={user.uid} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-8 py-5 text-xs font-black text-muted-foreground text-center">{idx + 1}</td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-muted rounded-xl overflow-hidden border border-border shrink-0">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="profile" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground leading-none mb-1.5">{user.displayName}</p>
                            <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground">
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
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-tight">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground/50" />
                          건명기업 본사 / 현장 A
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                         {getStatusBadge(user)}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                           <select 
                             className="text-[10px] font-black bg-muted border border-border rounded-lg px-2 py-1 cursor-pointer focus:ring-1 focus:ring-primary text-foreground"
                             value={user.status || (user.isActive ? 'ACTIVE' : 'RETIRED')}
                             onChange={(e) => handleUpdateStatus(user.uid, e.target.value)}
                           >
                             <option value="ACTIVE">재직 중</option>
                             <option value="ON_LEAVE">휴직 중</option>
                             <option value="RETIRED">퇴직</option>
                           </select>
                           <button className="p-2 hover:bg-card hover:shadow-md rounded-xl transition-all text-muted-foreground" title="상세 정보">
                              <Edit3 className="w-4 h-4" />
                           </button>
                           <button className="p-2 hover:bg-rose-500/10 hover:shadow-md rounded-xl transition-all text-rose-500" title="삭제">
                              <Trash2 className="w-4 h-4" />
                           </button>
                           <button className="p-2 hover:bg-card hover:shadow-md rounded-xl transition-all text-muted-foreground">
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
          <div className="px-10 py-6 border-t border-border bg-muted/20 flex justify-between items-center text-xs font-black text-muted-foreground">
             <span>총 {filteredUsers.length}명의 데이터가 파악되었습니다.</span>
             <div className="flex gap-2">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border border-border text-foreground">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background border border-transparent hover:border-border text-muted-foreground">2</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background border border-transparent hover:border-border text-muted-foreground">3</button>
             </div>
          </div>
        </div>
      </div>
    </PCAdminLayout>
  );
};

export default PCAdminPersonnel;
