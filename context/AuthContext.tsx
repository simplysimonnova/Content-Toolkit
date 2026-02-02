import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
// Fix: Consolidating and standardizing modular imports for better compatibility and resolving missing member errors
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            // Set the role directly from the DB
            setRole(data.role || 'user');
            
            // Update profile info without overwriting the role
            await setDoc(userRef, { 
              lastLogin: serverTimestamp(),
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              email: firebaseUser.email
            }, { merge: true });
          } else {
            // New user: default to 'user'
            const defaultRole = 'user';
            await setDoc(userRef, {
              email: firebaseUser.email,
              role: defaultRole,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL
            });
            setRole(defaultRole);
          }
          setUser(firebaseUser);
        } catch (error) {
          console.error("Auth Firestore Fetch Error:", error);
          setUser(firebaseUser);
          setRole('user');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    role,
    loading,
    isAdmin: role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};