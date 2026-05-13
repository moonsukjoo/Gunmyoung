import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { UserProfile, Department } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Search, 
  Filter,
  Medal,
  TrendingUp,
  Award,
  Lock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export const SafetyLeaderboard: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const isUnauthorized = profile && ['사원', '조장'].includes(profile.position?.trim() || '');

  useEffect(() => {
    if (isUnauthorized) {
      setLoading(false);
      return;
    }

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeDepts = onSnapshot(query(collection(db, 'departments'), orderBy('name')), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'departments');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeDepts();
    };
  }, [isUnauthorized]);

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const matchesSearch = (user.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                             user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDeptId === 'all' || user.departmentId === selectedDeptId;
        return matchesSearch && matchesDept;
      })
      .sort((a, b) => (b.safetyScore ?? 100) - (a.safetyScore ?? 100));
  }, [users, searchTerm, selectedDeptId]);

  if (isUnauthorized) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-rose-500/10 rounded-[2.5rem] flex items-center justify-center text-rose-500">
          <Lock className="w-10 h-10" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-foreground">접근 권한 없음</h3>
          <p className="text-sm font-bold text-muted-foreground leading-relaxed">
            안전 지수 랭킹은 팀장 및 관리자 직급 이상만<br/>확인이 가능합니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 px-1">
      <header className="py-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-6 h-6 text-amber-500" />
          <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">안전 지수 랭킹</h2>
        </div>
        <p className="text-muted-foreground font-bold">건명기업 안전 우수자 랭킹입니다</p>
      </header>

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input 
              placeholder="이름 또는 사번 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-14 pl-11 bg-card border-border rounded-2xl text-foreground font-bold placeholder:text-muted-foreground/30"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedDeptId('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                selectedDeptId === 'all' 
                  ? "bg-primary border-primary text-white shadow-md shadow-primary/20" 
                  : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
              )}
            >
              전체
            </button>
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDeptId(dept.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  selectedDeptId === dept.id 
                    ? "bg-primary border-primary text-white shadow-md shadow-primary/20" 
                    : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                )}
              >
                {dept.name}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 Podium (Optional but looks nice) */}
        {!searchTerm && selectedDeptId === 'all' && filteredUsers.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 pt-4">
            {/* 2nd Place */}
            <div className="flex flex-col items-center gap-2 pt-8">
              <div className="relative">
                <div className="w-14 h-14 bg-slate-300 rounded-2xl flex items-center justify-center text-xl font-black text-slate-600 shadow-lg border-2 border-slate-200">
                  {filteredUsers[1].displayName?.charAt(0)}
                </div>
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-slate-400 rounded-full border-4 border-background flex items-center justify-center">
                  <Medal className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-foreground truncate w-20">{filteredUsers[1].displayName}</p>
                <p className="text-[10px] font-black text-slate-500">{filteredUsers[1].safetyScore || 100}pts</p>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-amber-500/20 border-4 border-white/20">
                  {filteredUsers[0].displayName?.charAt(0)}
                </div>
                <div className="absolute -top-4 -right-4 w-10 h-10 bg-amber-600 rounded-full border-4 border-background flex items-center justify-center shadow-lg">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-foreground truncate w-24">{filteredUsers[0].displayName}</p>
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <p className="text-sm font-black text-primary">{filteredUsers[0].safetyScore || 100}pts</p>
                </div>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center gap-2 pt-12">
              <div className="relative">
                <div className="w-12 h-12 bg-orange-300 rounded-xl flex items-center justify-center text-lg font-black text-orange-700 shadow-md border-2 border-orange-200">
                  {filteredUsers[2].displayName?.charAt(0)}
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-orange-400 rounded-full border-4 border-background flex items-center justify-center">
                  <Award className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-foreground truncate w-16">{filteredUsers[2].displayName}</p>
                <p className="text-[9px] font-black text-orange-600/60">{filteredUsers[2].safetyScore || 100}pts</p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard List */}
        <div className="space-y-2 pt-4">
          {filteredUsers.map((user, idx) => (
            <motion.div 
              key={user.uid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.5) }}
              className="bg-card p-4 rounded-3xl border border-border flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all group-hover:scale-105",
                  idx === 0 ? "bg-amber-500/20 text-amber-600 shadow-amber-500/10 shadow-lg" : 
                  idx === 1 ? "bg-slate-300/30 text-slate-600" :
                  idx === 2 ? "bg-orange-300/30 text-orange-600" :
                  "bg-muted text-muted-foreground"
                )}>
                  {idx < 3 ? (
                    idx === 0 ? <Trophy className="w-5 h-5" /> : 
                    idx === 1 ? <Medal className="w-5 h-5" /> : 
                    <Award className="w-5 h-5" />
                  ) : (idx + 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-foreground">{user.displayName}</span>
                    <Badge variant="outline" className="text-[9px] font-black bg-muted border-none opacity-60">
                       {user.departmentName || '소속 없음'}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{user.employeeId}</span>
                </div>
              </div>

                <div className="text-right">
                <div className={cn(
                  "text-xl font-black tabular-nums", 
                  (user.safetyScore ?? 100) > 100 ? "text-emerald-500" : 
                  (user.safetyScore ?? 100) === 100 ? "text-blue-500" : 
                  "text-rose-500"
                )}>
                  {user.safetyScore ?? 100}
                  <span className="text-[10px] ml-1 opacity-40 uppercase">pts</span>
                </div>
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="py-20 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-black text-muted-foreground">데이터를 불러오는 중...</p>
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="py-20 text-center opacity-20">
               <Trophy className="w-16 h-16 mx-auto mb-4" />
               <p className="text-sm font-black text-muted-foreground">랭킹 정보가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
