import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { BookOpen, AlertCircle, Info, RefreshCcw } from 'lucide-react';
// Fix: Standardizing modular exports from firebase/auth into a single clean import statement to resolve resolution errors
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult 
} from 'firebase/auth';

export const LoginForm: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error("Redirect Result Error:", err);
      if (err.code !== 'auth/invalid-pending-token') {
        setError(`Redirect Error: ${err.message}`);
      }
    });
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ 
      prompt: 'select_account',
      hd: 'novakidschool.com'
    });

    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Popup Error:", err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/internal-error') {
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirErr: any) {
          setError(`Redirect failed: ${redirErr.message}`);
          setLoading(false);
        }
      } else {
        setError(err.message || 'Google sign-in failed.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all">
        <div className="p-8">
          <div className="flex flex-col items-center mb-10">
            <div className="p-4 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 mb-6">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Content Toolkit</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Workspace Authentication Required</p>
          </div>

          <div className="space-y-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-sm ring-1 ring-black/5"
            >
              {loading ? (
                <RefreshCcw className="w-5 h-5 animate-spin text-orange-50" />
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              )}
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </button>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="break-words font-medium">{error}</span>
              </div>
            )}
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 flex items-start gap-3">
              <div className="p-1 bg-white dark:bg-slate-700 rounded shadow-sm">
                <Info className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Please use your <strong>@novakidschool.com</strong> account. Internal users are automatically granted full access.
              </p>
            </div>
          </div>
        </div>
        <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">
            Novakid Educational Content Tool v1.6.0
          </p>
        </div>
      </div>
    </div>
  );
};