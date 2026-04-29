import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '@/src/firebase';
import { collection, query, where, getDocs, updateDoc, doc, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, Chrome, RefreshCw, KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { PinKeypad } from '@/src/components/PinKeypad';
import { cn } from '@/lib/utils';
import { UserProfile } from '../types';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isRememberId, setIsRememberId] = useState(false);
  
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    employeeId: '',
    birthDate: ''
  });
  const [isResetLoading, setIsResetLoading] = useState(false);

  const handleFindPassword = async () => {
    if (!forgotPasswordForm.employeeId || !forgotPasswordForm.birthDate) {
      toast.error('모든 정보를 입력해주세요.');
      return;
    }

    setIsResetLoading(true);
    try {
      const inputId = forgotPasswordForm.employeeId.trim();
      const rawDate = forgotPasswordForm.birthDate.trim().replace(/[\.\-\s]/g, ''); // Normalize input date to only numbers
      
      console.log(`Starting search for ID: ${inputId}, Normalized Date: ${rawDate}`);

      // Search by ID first (lenient matching)
      const q = query(
        collection(db, 'users'), 
        where('employeeId', 'in', [inputId, inputId.toLowerCase(), inputId.toUpperCase()]),
        limit(1)
      );
      
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('일치하는 사원 정보가 없습니다. (사번 확인)');
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data() as UserProfile;
      const dbBirthDate = (userData.birthDate || '').trim().replace(/[\.\-\s]/g, '');
      
      // Match birthdate formats (YYYYMMDD or YYMMDD)
      const isMatch = (dbBirthDate === rawDate) || 
                      (dbBirthDate.length === 8 && dbBirthDate.slice(2) === rawDate) ||
                      (rawDate.length === 8 && rawDate.slice(2) === dbBirthDate);

      if (!isMatch) {
        console.log(`Date mismatch: DB(${dbBirthDate}) vs Input(${rawDate})`);
        toast.error('생년월일이 일치하지 않습니다.');
        return;
      }
      
      await updateDoc(doc(db, 'users', userDoc.id), {
        hasCustomPin: false,
        failedLoginAttempts: 0,
        isLocked: false,
        updatedAt: new Date().toISOString()
      });

      toast.success('비밀번호가 사번으로 초기화되었습니다.');
      setIsForgotPasswordOpen(false);
      setForgotPasswordForm({ employeeId: '', birthDate: '' });
    } catch (error: any) {
      console.error("Password Reset Error:", error);
      toast.error('오류가 발생했습니다: ' + (error.message || '다시 시도해주세요'));
    } finally {
      setIsResetLoading(false);
    }
  };
  
  const [rememberedId, setRememberedId] = useState<string | null>(null);
  const [rememberedName, setRememberedName] = useState<string | null>(null);
  const [isRememberedMode, setIsRememberedMode] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('remembered_employeeId');
    const savedName = localStorage.getItem('remembered_displayName');
    const isRemembered = localStorage.getItem('save_employee_id') === 'true';
    if (isRemembered && savedId) {
      setIsRememberId(true);
      setEmployeeId(savedId);
      if (savedName) {
        setRememberedId(savedId);
        setRememberedName(savedName);
        setIsRememberedMode(true);
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('로그인 성공');
      navigate('/');
    } catch (e) { toast.error('로그인 실패'); } finally { setIsGoogleLoading(false); }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;
    const id = (isRememberedMode ? (rememberedId || '') : employeeId).trim();
    if (!id || !password) { toast.error('정보를 입력하세요'); return; }
    setIsLoading(true);
    
    // Log for debugging (only in dev/training)
    console.log(`Attempting login for: ${id}`);
    
    try {
      const email = id.includes('@') ? id : `${id.toLowerCase()}@shipyard.com`;
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (!isRememberedMode && password === id && password.length >= 6) {
          await createUserWithEmailAndPassword(auth, email, password);
        } else {
          console.error("Login Error:", err.code, err.message);
          throw err;
        }
      }
      
      if (isRememberId) {
        localStorage.setItem('remembered_employeeId', id);
        localStorage.setItem('save_employee_id', 'true');
      } else {
        localStorage.removeItem('remembered_employeeId');
        localStorage.setItem('save_employee_id', 'false');
      }
      toast.success('로그인 성공');
      navigate('/');
    } catch (e: any) { 
      toast.error('로그인 실패: 정보를 확인해주세요'); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handlePinInput = (digit: string) => {
    if (password.length < 20) setPassword(prev => prev + digit);
  };

  const handlePinDelete = () => setPassword(prev => prev.slice(0, -1));
  const handlePinClear = () => setPassword('');

  // Handle PIN auto-login only for 6 digit PINs if in remembered mode
  useEffect(() => {
    if (isRememberedMode && password.length === 6) {
      handleLogin();
    }
  }, [password, isRememberedMode]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col h-full space-y-8 animate-in fade-in duration-700">
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white">
              {isRememberedMode ? `${rememberedName}님,` : "반갑습니다,"}
            </h2>
            <p className="text-muted-foreground font-bold text-sm">
              {isRememberedMode ? "비밀번호를 입력해 주세요" : "사번과 비밀번호를 입력해 주세요"}
            </p>
          </div>
          
          <div className="flex gap-3 h-4 items-center">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={cn("w-2.5 h-2.5 rounded-full transition-all duration-300", password.length > i ? "bg-primary scale-125 shadow-[0_0_10px_#3182f6]" : "bg-white/10")} />
            ))}
            {password.length > 6 && <span className="text-[10px] font-black text-primary">+{password.length - 6}</span>}
          </div>
        </div>

        <div className="space-y-4 px-2">
          {!isRememberedMode && (
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <Input 
                placeholder="사원번호 입력" 
                value={employeeId} 
                onChange={e => setEmployeeId(e.target.value)} 
                className="h-16 pl-14 bg-card border-none rounded-2xl text-lg font-black text-white placeholder:text-muted-foreground/30 focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <Input 
              type="password"
              placeholder="비밀번호 입력" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="h-16 pl-14 bg-card border-none rounded-2xl text-lg font-black text-white placeholder:text-muted-foreground/30 focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>
          
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Checkbox id="rem" checked={isRememberId} onCheckedChange={v => setIsRememberId(!!v)} className="bg-card border-white/10" />
              <label htmlFor="rem" className="text-xs font-black text-muted-foreground">자동 로그인</label>
            </div>
            
            <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
              <DialogTrigger asChild>
                <button type="button" className="text-xs font-black text-primary hover:underline">비밀번호 찾기</button>
              </DialogTrigger>
              <DialogContent className="bg-card border-none rounded-[2rem] shadow-2xl max-w-sm w-[90%] p-8 overflow-hidden text-white">
                <DialogHeader className="items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <KeyRound className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-xl font-black text-white tracking-tighter">비밀번호 찾기</DialogTitle>
                    <DialogDescription className="text-muted-foreground font-bold text-xs text-center">
                      사번과 생년월일을 입력하시면<br />비밀번호가 사번으로 초기화됩니다.
                    </DialogDescription>
                  </div>
                </DialogHeader>
                
                <div className="space-y-4 py-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">사원번호</Label>
                    <Input 
                      placeholder="사번 입력 (예: X22222)"
                      value={forgotPasswordForm.employeeId}
                      onChange={e => setForgotPasswordForm(prev => ({...prev, employeeId: e.target.value}))}
                      className="h-14 bg-white/5 border-white/5 rounded-xl font-bold text-white placeholder:text-white/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">생년월일</Label>
                    <Input 
                      type="text"
                      placeholder="예: 1986.03.30 또는 860330"
                      value={forgotPasswordForm.birthDate}
                      onChange={e => setForgotPasswordForm(prev => ({...prev, birthDate: e.target.value}))}
                      className="h-14 bg-white/5 border-white/5 rounded-xl font-bold text-white placeholder:text-white/20"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleFindPassword}
                  disabled={isResetLoading}
                  className="w-full h-14 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20"
                >
                  {isResetLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : '비밀번호 초기화'}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <PinKeypad 
          onInput={handlePinInput} 
          onDelete={handlePinDelete} 
          onClear={handlePinClear} 
          passwordLength={password.length}
          onBack={() => setIsRememberedMode(false)}
          onOtherMethod={() => setIsRememberedMode(false)}
          className={cn(!isRememberedMode && "hidden")}
        />

        <div className="flex flex-col gap-4 px-2">
          <Button 
            onClick={() => handleLogin()} 
            disabled={isLoading || password.length < 1} 
            className="h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : '로그인하기'}
          </Button>

          {isRememberedMode && (
            <button 
              onClick={() => {
                setIsRememberedMode(false);
                setPassword('');
                setEmployeeId(''); // Also clear employeeId when switching
              }} 
              className="text-xs font-black text-white/20 uppercase tracking-widest text-center w-full hover:text-white transition-colors py-4"
            >
              다른 계정으로 로그인
            </button>
          )}

          {!isRememberedMode && (
            <>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-muted-foreground/20"><span className="bg-background px-4">OR</span></div>
              </div>
              <Button variant="outline" type="button" onClick={handleGoogleLogin} className="h-16 bg-white/5 border-none text-white font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Chrome className="w-6 h-6 text-primary" /> 구글 계정으로 계속하기
              </Button>
            </>
          )}
        </div>

        <div className="pt-6 text-center">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-20">© 2024 건명기업 HRM</p>
        </div>
      </div>
    </div>
  );
};
