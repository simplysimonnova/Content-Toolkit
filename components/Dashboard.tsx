
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Clock, Zap, Star, ChevronRight, AlertTriangle } from 'lucide-react';
import { AppPage } from '../types';

interface DashboardProps {
  onNavigate: (page: AppPage) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    setError(null);
    const q = query(
      collection(db, 'usage'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentActions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Dashboard fetch error:", err);
      // Specifically check for missing index error to show a helpful message
      if (err.message.includes('requires an index')) {
        setError("Database index required. Please check the browser console (F12) for the link to create it.");
      } else {
        setError("Unable to load activity logs.");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="animate-fade-in space-y-8">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-8 text-white shadow-lg shadow-orange-500/20">
        <h1 className="text-3xl font-black mb-2 uppercase tracking-tight">Welcome back, {user?.displayName?.split(' ')[0] || 'Teacher'}!</h1>
        <p className="text-orange-100 font-medium">Ready to create some amazing A2 English content today?</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-slate-800 dark:text-white font-bold">
              <Clock className="w-5 h-5 text-orange-500" />
              Recent Activity
            </div>
            
            <div className="space-y-4">
              {loading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : error ? (
                <div className="py-10 px-4 flex flex-col items-center justify-center text-center gap-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{error}</p>
                </div>
              ) : recentActions.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-sm italic">No recent actions recorded yet.</p>
              ) : (
                recentActions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold dark:text-white">{action.tool}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{new Date(action.timestamp?.toDate()).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                      {action.model?.split('-')[1]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-slate-800 dark:text-white font-bold">
              <Star className="w-5 h-5 text-orange-500" />
              Quick Start
            </div>
            <div className="space-y-2">
              {[
                { label: 'Lesson Descriptions', page: 'lesson-descriptions' as AppPage },
                { label: 'General Proofing', page: 'proofing-bot' as AppPage },
                { label: 'TAF Generator', page: 'taf-generator' as AppPage }
              ].map((btn) => (
                <button
                  key={btn.page}
                  onClick={() => onNavigate(btn.page)}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/10 border border-transparent hover:border-orange-200 dark:hover:border-orange-800 transition-all text-sm font-bold text-slate-600 dark:text-slate-300 group"
                >
                  {btn.label}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
