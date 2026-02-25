
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Clock, Zap, Star, ChevronRight, AlertTriangle, Info, X, Check } from 'lucide-react';
import { AppPage } from '../types';

interface DashboardProps {
  onNavigate: (page: AppPage) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

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

      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-orange-500" />
                About This Toolkit
              </h3>
              <button onClick={() => setShowInfo(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed">
              <div>
                <h4 className="font-black text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-widest">What This Tool Is</h4>
                <ul className="space-y-2">
                  {[
                    'A central AI-powered content toolkit for our internal workflows',
                    'A single place to run quality checks, generate content, and automate repetitive tasks',
                    'A governance-controlled AI environment (not random AI usage)',
                    'Designed specifically for our content, QA, and curriculum processes',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-widest">What It Does</h4>
                <ul className="space-y-2">
                  {[
                    'Speeds up content production (descriptions, competencies, tickets, notes, etc.)',
                    'Standardises quality across lessons and materials',
                    'Reduces manual admin work',
                    'Automates repetitive formatting and validation tasks',
                    'Supports structured QA checks before release',
                    'Tracks usage and activity for transparency',
                    'Allows controlled AI upgrades without disrupting workflows',
                    'Gives admin-level control over how AI is used',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-widest">Why It Matters</h4>
                <ul className="space-y-2">
                  {[
                    'Saves time without sacrificing quality',
                    'Keeps AI usage controlled and measurable',
                    'Reduces operational risk',
                    'Creates consistency across teams',
                    'Scales with our content production needs',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                onClick={() => setShowInfo(false)}
                className="px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-8 text-white shadow-lg shadow-orange-500/20">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black mb-2 uppercase tracking-tight">Welcome back, {user?.displayName?.split(' ')[0] || 'Teacher'}!</h1>
            <p className="text-orange-100 font-medium">Ready to create some amazing A2 English content today?</p>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors shrink-0"
            title="About this toolkit"
          >
            <Info className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
      </div>
    </div>
  );
};
