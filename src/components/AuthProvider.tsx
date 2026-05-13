import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, query, where, limit, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, Role } from '../types';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Safety net: Force loading to end if it hangs too long (e.g. Firebase initialization issues)
    const initTimeout = setTimeout(() => {
      console.warn("Auth initialization timed out, forcing ready state");
      setLoading(false);
      setIsAuthReady(true);
    }, 5000);

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        
        if (firebaseUser) {
          const email = firebaseUser.email || '';
          const namePrefix = email.split('@')[0] || '';
          const employeeId = namePrefix;
          const usersRef = collection(db, 'users');

          // Check for manual profile recovery/migration every time at login
          const syncPerformed = sessionStorage.getItem(`sync_${firebaseUser.uid}`);
          if (!syncPerformed) {
            try {
              const possibleIds = [employeeId, employeeId.toUpperCase(), employeeId.toLowerCase()];
              const qSync = query(usersRef, where('employeeId', 'in', [...new Set(possibleIds)]));
              const syncSnapshot = await getDocs(qSync);
              
              let manualProfileData: any = null;
              let manualDocId: string | null = null;
              
              syncSnapshot.docs.forEach(d => {
                if (d.id !== firebaseUser.uid) {
                  const data = d.data();
                  if (!manualProfileData || data.role !== 'EMPLOYEE') {
                    manualProfileData = data;
                    manualDocId = d.id;
                  }
                }
              });

              if (manualDocId && manualProfileData) {
                const migratedProfile = {
                  ...manualProfileData,
                  uid: firebaseUser.uid,
                  email: email
                };
                await setDoc(doc(db, 'users', firebaseUser.uid), migratedProfile);
                await deleteDoc(doc(db, 'users', manualDocId));
                sessionStorage.setItem(`sync_${firebaseUser.uid}`, 'true');
                toast.success('임직원 정보가 동기화되었습니다.');
              }
            } catch (err) {
              console.warn("Profile sync error:", err);
            }
          }

          // Use onSnapshot for real-time profile updates
          unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
            clearTimeout(initTimeout); // Profile found or created, clear the guard
            try {
              if (snapshot.exists()) {
                const currentProfile = snapshot.data() as UserProfile;
                setProfile(currentProfile);
                
                // CEO Bootstrap logic
                const isCEOEmail = firebaseUser.email?.toLowerCase() === 'tjrwnfjqm1@gmail.com';
                const emailPrefix = email.split('@')[0].toLowerCase();
                const isX66626 = 
                  emailPrefix === 'x66626' ||
                  employeeId.trim().toLowerCase().includes('x66626') || 
                  currentProfile.employeeId?.trim()?.toLowerCase()?.includes('x66626') || 
                  currentProfile.displayName?.toLowerCase()?.includes('x66626') ||
                  email.toLowerCase().includes('x66626') ||
                  firebaseUser.displayName?.toLowerCase()?.includes('x66626');

                if (isCEOEmail && currentProfile.role !== 'CEO') {
                  await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'CEO' as Role }).catch(() => {});
                } else if (!isCEOEmail && isX66626 && (currentProfile.role !== 'EMPLOYEE' || !currentProfile.employeeId?.includes('x66626') || currentProfile.position !== '사원')) {
                  await updateDoc(doc(db, 'users', firebaseUser.uid), { 
                    role: 'EMPLOYEE' as Role,
                    permissions: [],
                    position: '사원',
                    employeeId: 'x66626',
                    displayName: currentProfile.displayName?.includes('x66626') ? currentProfile.displayName : '임직원(x66626)'
                  }).catch(() => {});
                }
              } else {
                const isBootstrapCEO = email.toLowerCase() === 'tjrwnfjqm1@gmail.com';
                const emailPrefix = email.split('@')[0].toLowerCase();
                const isX66626Email = email.toLowerCase().includes('x66626') || emailPrefix === 'x66626';
                
                const newProfile: UserProfile = {
                  uid: firebaseUser.uid,
                  employeeId: isX66626Email ? 'x66626' : employeeId,
                  email: firebaseUser.email || '',
                  displayName: firebaseUser.displayName || (isX66626Email ? '임직원(x66626)' : employeeId.toUpperCase()) || 'Anonymous',
                  role: isBootstrapCEO ? 'CEO' : 'EMPLOYEE',
                  position: isX66626Email ? '사원' : (isBootstrapCEO ? '사장' : '사원'),
                  isActive: true,
                  status: 'ACTIVE',
                  joinedAt: new Date().toISOString(),
                  kudosCount: 0,
                };
                await setDoc(doc(db, 'users', firebaseUser.uid), newProfile).catch(() => {});
                setProfile(newProfile);
              }
            } catch (err) {
              console.error("Profile internal error:", err);
            } finally {
              setLoading(false);
              setIsAuthReady(true);
            }
          }, (error) => {
            clearTimeout(initTimeout);
            console.warn("Profile snapshot error:", error);
            setLoading(false);
            setIsAuthReady(true);
          });
        } else {
          clearTimeout(initTimeout);
          if (unsubscribeProfile) unsubscribeProfile();
          setProfile(null);
          setLoading(false);
          setIsAuthReady(true);
        }
      } catch (err) {
        clearTimeout(initTimeout);
        console.error("Auth process error:", err);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      clearTimeout(initTimeout);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
