
import React, { useState } from 'react';
import { BookOpen, FileText, Wrench, Moon, Sun, Settings, LayoutGrid, ImageIcon, Volume2, LogOut, Link2 } from 'lucide-react';
import { AppPage } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { AdminConsoleModal } from './AdminConsoleModal';
import { auth } from '../services/firebase';

interface HeaderProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate }) => {
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, user } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      try {
        await auth.signOut();
      } catch (error) {
        console.error("Logout failed", error);
      }
    }
  };

  const getLinkClass = (page: AppPage) => {
    const isActive = currentPage === page;
    return `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-orange-600 text-white shadow-inner ring-1 ring-inset ring-orange-700'
        : 'text-orange-50 hover:bg-orange-500/50 hover:text-white dark:text-slate-200 dark:hover:bg-slate-700'
    }`;
  };

  return (
    <>
      <header className="bg-orange-500 dark:bg-slate-900 text-white shadow-lg sticky top-0 z-50 transition-colors duration-300 border-b border-orange-600 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Fix: changed 'lesson-tools' to valid AppPage 'lesson-descriptions' */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('lesson-descriptions')}>
              <div className="p-1.5 bg-orange-400 dark:bg-slate-800 rounded-lg shadow-sm border border-orange-300/20 dark:border-slate-700">
                <BookOpen className="w-5 h-5 text-white dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight leading-none text-white dark:text-slate-100">Content Toolkit</h1>
                <p className="text-orange-100 dark:text-slate-400 text-xs mt-0.5">A2 English Lesson Generator</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <nav className="flex items-center space-x-1 lg:space-x-2">
                {/* Fix: changed 'lesson-tools' to valid AppPage 'lesson-descriptions' */}
                <button onClick={() => onNavigate('lesson-descriptions')} className={getLinkClass('lesson-descriptions')}>
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Lesson</span>
                </button>
                {/* Fix: changed 'llm-tools' to valid AppPage 'word-cleaner' as a representative entry for that category */}
                <button onClick={() => onNavigate('word-cleaner')} className={getLinkClass('word-cleaner')}>
                  <Wrench className="w-4 h-4" />
                  <span className="hidden sm:inline">LLM</span>
                </button>
                {/* Fix: changed 'image-tools' to valid AppPage 'image-extractor' */}
                <button onClick={() => onNavigate('image-extractor')} className={getLinkClass('image-extractor')}>
                  <ImageIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Images</span>
                </button>
                {/* Fix: changed 'sound-tools' to valid AppPage 'sound-generator' */}
                <button onClick={() => onNavigate('sound-generator')} className={getLinkClass('sound-generator')}>
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Sounds</span>
                </button>
                <button onClick={() => onNavigate('useful-links')} className={getLinkClass('useful-links')}>
                  <Link2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Links</span>
                </button>
                {/* Fix: changed 'general-tools' to valid AppPage 'deduplicator' */}
                <button onClick={() => onNavigate('deduplicator')} className={getLinkClass('deduplicator')}>
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">General</span>
                </button>
              </nav>

              <div className="flex items-center gap-2 pl-2 border-l border-orange-400 dark:border-slate-700 ml-1">
                {isAdmin && (
                  <button
                    onClick={() => setShowAdmin(true)}
                    className="p-2 rounded-full bg-orange-600/50 dark:bg-slate-800 hover:bg-orange-600 dark:hover:bg-slate-700 transition-colors text-white dark:text-orange-400 border border-transparent dark:border-slate-700"
                    title="Admin Console"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full bg-orange-600/50 dark:bg-slate-800 hover:bg-orange-600 dark:hover:bg-slate-700 transition-colors text-white dark:text-orange-400 border border-transparent dark:border-slate-700"
                  title="Toggle Theme"
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                <div className="flex items-center gap-2 ml-1">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="User profile" className="w-7 h-7 rounded-full border border-orange-300 dark:border-slate-600 shadow-sm" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-orange-600 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold border border-orange-400 dark:border-slate-600">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-full bg-orange-600/50 dark:bg-slate-800 hover:bg-red-500 transition-colors text-white dark:text-slate-300 border border-transparent dark:border-slate-700"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      {isAdmin && <AdminConsoleModal isOpen={showAdmin} onClose={() => setShowAdmin(false)} />}
    </>
  );
};
