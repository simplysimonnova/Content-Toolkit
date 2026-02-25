
import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, FileText, Moon, Sun, Settings, LayoutDashboard,
  ImageIcon, Volume2, Link2, ChevronLeft, ChevronRight,
  TableProperties, ListFilter, Tag, ShieldBan, Search,
  CreditCard, Palette, ClipboardCheck, Compass, Sparkles, PenTool,
  Zap, Map, Presentation, MessageSquareText, Mic2, Wand2, PenLine, SearchCheck,
  ChevronDown, ShieldCheck, Loader2, ListOrdered, Shield, StickyNote, Hash, Terminal, Ticket, Braces, BarChart2
} from 'lucide-react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { AppPage } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { AdminConsoleModal } from './AdminConsoleModal';
import { ChangelogModal } from './ChangelogModal';

const ICON_MAP: Record<string, any> = {
  'Zap': Zap, 'Map': Map, 'Sparkles': Sparkles, 'Presentation': Presentation,
  'MessageSquareText': MessageSquareText, 'Search': Search, 'Palette': Palette,
  'PenLine': PenLine, 'Wand2': Wand2, 'Mic2': Mic2, 'Volume2': Volume2,
  'SearchCheck': SearchCheck, 'ShieldCheck': ShieldCheck, 'ListFilter': ListFilter,
  'Tag': Tag, 'TableProperties': TableProperties, 'FileText': FileText,
  'ShieldBan': ShieldBan, 'Link2': Link2, 'CreditCard': CreditCard,
  'ClipboardCheck': ClipboardCheck, 'ListOrdered': ListOrdered,
  'StickyNote': StickyNote, 'Hash': Hash, 'Terminal': Terminal, 'Ticket': Ticket, 'Braces': Braces, 'BarChart2': BarChart2
};

const FALLBACK_GROUPS: NavGroupConfig[] = [
  {
    id: 'planning_curriculum',
    title: 'Planning & Curriculum',
    items: [
      { id: 'pc1', label: 'S&S Compactor', icon: 'Zap', page: 'ss-compactor' },
      { id: 'pc2', label: 'Curriculum Gap Spotter', icon: 'SearchCheck', page: 'gap-spotter' }
    ]
  },
  {
    id: 'lesson_creation',
    title: 'Lesson Creation',
    items: [
      { id: 'lc1', label: 'Lesson Descriptions', icon: 'FileText', page: 'lesson-descriptions' },
      { id: 'lc2', label: 'Lesson Plan Generator', icon: 'Wand2', page: 'plan-generator' },
      { id: 'lc3', label: 'Slide-creator Studio', icon: 'Presentation', page: 'slide-creator' },
      { id: 'lc4', label: 'TN Standardizer', icon: 'FileText', page: 'tn-standardizer' },
      { id: 'lc5', label: 'Lesson QA', icon: 'ShieldCheck', page: 'ai-qa-runner' },
      { id: 'lc6', label: 'TAF Generator', icon: 'TableProperties', page: 'taf-generator' }
    ]
  },
  {
    id: 'validation_qa',
    title: 'Validation & QA',
    items: [
      { id: 'vq1', label: 'General Proofing Bot', icon: 'ClipboardCheck', page: 'proofing-bot' },
      { id: 'vq2', label: 'Lesson Proofing Bot', icon: 'ShieldCheck', page: 'lesson-proofing-bot' },
      { id: 'vq3', label: 'Thematic QA', icon: 'ShieldCheck', page: 'thematic-qa' },
      { id: 'vq3r', label: 'TQA Reports', icon: 'BarChart2', page: 'tqa-reports' },
      { id: 'vq4', label: 'Lesson QA', icon: 'ShieldCheck', page: 'ai-qa-runner' }
    ]
  },
  {
    id: 'llm_content',
    title: 'LLM & Content Processing',
    items: [
      { id: 'lp1', label: 'Word Cleaner', icon: 'ListFilter', page: 'word-cleaner' },
      { id: 'lp2', label: 'Topic Assigner', icon: 'Tag', page: 'topic-assigner' },
      { id: 'lp3', label: 'List Merger', icon: 'ListOrdered', page: 'list-merger' },
      { id: 'lp4', label: 'LLM Content Checker', icon: 'Search', page: 'llm-content-checker' },
      { id: 'lp5', label: 'Deduplicator', icon: 'ShieldBan', page: 'deduplicator' }
    ]
  },
  {
    id: 'competency_pipeline',
    title: 'Competency Pipeline',
    items: [
      { id: 'cp1', label: '1 Competency Builder', icon: 'TableProperties', page: 'comp-import-creator' },
      { id: 'cp2', label: '2 Competency CSV Normalizer', icon: 'TableProperties', page: 'competency-csv-normaliser' },
      { id: 'cp3', label: '3 Deduplicator', icon: 'ShieldBan', page: 'deduplicator' },
      { id: 'cp4', label: '4 Row Expander', icon: 'ListFilter', page: 'row-expander' },
      { id: 'cp5', label: '5 ID Resolver', icon: 'Link2', page: 'id-resolver' },
      { id: 'cp6', label: '6 Directus JSON Builder', icon: 'Braces', page: 'directus-json-builder' }
    ]
  },
  {
    id: 'media_assets',
    title: 'Media & Assets',
    items: [
      { id: 'm1', label: 'Image Extractor', icon: 'Link2', page: 'image-extractor' },
      { id: 'm2', label: 'Image Renamer', icon: 'Search', page: 'image-renamer' },
      { id: 'm3', label: 'Sound Generator', icon: 'Volume2', page: 'sound-generator' },
      { id: 'm4', label: 'Nano Banana Studio', icon: 'Palette', page: 'nano-banana' },
      { id: 'm5', label: 'Prompt Writer', icon: 'PenLine', page: 'prompt-writer' },
      { id: 'm6', label: 'Prompt Redesigner', icon: 'Wand2', page: 'prompt-rewriter' }
    ]
  },
  {
    id: 'utilities',
    title: 'Utilities',
    items: [
      { id: 'u1', label: 'Class ID Finder', icon: 'Hash', page: 'class-id-finder' },
      { id: 'u2', label: 'Jira Ticketer', icon: 'Ticket', page: 'jira-ticketer' },
      { id: 'u3', label: 'VR Validator', icon: 'Map', page: 'vr-validator' }
    ]
  },
  {
    id: 'resources',
    title: 'Resources',
    items: [
      { id: 'r1', label: 'Internal Notes', icon: 'StickyNote', page: 'internal-notes' },
      { id: 'r2', label: 'Useful Links', icon: 'Link2', page: 'useful-links' },
      { id: 'r3', label: 'Directus Guides', icon: 'Presentation', page: 'directus-guides' }
    ]
  }
];

interface NavItem {
  id: string;
  label: string;
  icon: string;
  page: string;
  adminOnly?: boolean;
}

interface NavGroupConfig {
  id: string;
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isCollapsed, setIsCollapsed }) => {
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, user } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [navGroups, setNavGroups] = useState<NavGroupConfig[]>([]);
  const [lockedTools, setLockedTools] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'navigation', 'sidebar_config'), (snap) => {
      if (snap.exists() && snap.data().groups?.length > 0) {
        const groups = snap.data().groups;
        setNavGroups(groups);
        // Initialize all groups as collapsed
        const initialOpenState: Record<string, boolean> = {};
        groups.forEach((g: NavGroupConfig) => {
          initialOpenState[g.title] = false;
        });
        setOpenGroups(initialOpenState);
      } else {
        setNavGroups(FALLBACK_GROUPS);
        // Initialize all fallback groups as collapsed
        const initialOpenState: Record<string, boolean> = {};
        FALLBACK_GROUPS.forEach(g => {
          initialOpenState[g.title] = false;
        });
        setOpenGroups(initialOpenState);
      }
      setLoading(false);
    }, (err) => {
      console.error("Sidebar feed failed, using fallback:", err);
      setNavGroups(FALLBACK_GROUPS);
      // Initialize all fallback groups as collapsed
      const initialOpenState: Record<string, boolean> = {};
      FALLBACK_GROUPS.forEach(g => {
        initialOpenState[g.title] = false;
      });
      setOpenGroups(initialOpenState);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'configurations'), (snap) => {
      const locked = new Set<string>();
      snap.docs.forEach(d => {
        if (d.data().isLocked) locked.add(d.id);
      });
      setLockedTools(locked);
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      try { await auth.signOut(); } catch (error) { console.error("Logout failed", error); }
    }
  };

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const filteredNavGroups = useMemo(() => {
    if (!searchQuery.trim()) return navGroups;

    return navGroups.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(group => group.items.length > 0);
  }, [navGroups, searchQuery]);

  const NavGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const isOpen = openGroups[title] || false;
    return (
      <div className="mb-2">
        {!isCollapsed && (
          <button
            onClick={() => toggleGroup(title)}
            className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 hover:text-slate-300 transition-colors group"
          >
            {title}
            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'}`} />
          </button>
        )}
        <div className={`space-y-1 px-2 overflow-hidden transition-all duration-300 ${isCollapsed || isOpen || searchQuery.trim() ? 'max-h-[800px] opacity-100 py-1' : 'max-h-0 opacity-0'}`}>
          {children}
        </div>
      </div>
    );
  };

  const NavLink: React.FC<{ page: string; iconName: string; label: string; adminOnly?: boolean }> = ({ page, iconName, label, adminOnly = false }) => {
    if (adminOnly && !isAdmin) return null;
    const Icon = ICON_MAP[iconName] || BookOpen;
    const isActive = currentPage === page;
    const isLocked = lockedTools.has(page);

    return (
      <button
        onClick={() => onNavigate(page as AppPage)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group relative ${isActive
          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
          : 'text-slate-400 dark:text-slate-500 hover:bg-slate-800 hover:text-orange-500 dark:hover:text-slate-200'
          }`}
        title={isCollapsed ? label : ''}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-orange-500'}`} />
        {!isCollapsed && (
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="truncate">{label}</span>
            {isLocked && <Shield className="w-3 h-3 text-teal-500" title="Stable Mode Enabled" />}
          </div>
        )}
        {isCollapsed && isLocked && (
          <div className="absolute top-1 right-1 w-2 h-2 bg-teal-500 rounded-full border border-[#0a0f1d]" />
        )}
      </button>
    );
  };

  return (
    <>
      <aside className={`fixed top-0 left-0 h-full bg-[#0a0f1d] border-r border-slate-800 transition-all duration-300 z-[60] flex flex-col ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="h-16 flex items-center px-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 flex-shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="animate-fade-in whitespace-nowrap">
                <h1 className="text-sm font-black tracking-tight text-white uppercase leading-tight">Content Workspace</h1>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-slate-500 font-bold tracking-tighter">TOOLKIT PRO</p>
                  <button onClick={() => setShowChangelog(true)} className="text-[9px] text-slate-600 hover:text-orange-500 font-mono transition-colors">v1.7.0</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Search */}
        {!isCollapsed && (
          <div className="px-3 mb-4 animate-fade-in">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within:text-orange-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all placeholder:text-slate-700"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide pb-10">
          <div className="px-2 mb-6">
            <NavLink page="dashboard" iconName="LayoutDashboard" label="Dashboard" />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-50">
              <Loader2 className="w-5 h-5 text-slate-700 animate-spin mb-2" />
              {!isCollapsed && <span className="text-[10px] font-bold text-slate-500">SYNCING MENU...</span>}
            </div>
          ) : (
            filteredNavGroups.map(group => (
              <div key={group.id}>
                <NavGroup title={group.title}>
                  {group.items.map(item => (
                    <NavLink
                      key={item.id}
                      page={item.page}
                      iconName={item.icon}
                      label={item.label}
                      adminOnly={item.adminOnly}
                    />
                  ))}
                </NavGroup>
              </div>
            ))
          )}

          {!loading && filteredNavGroups.length === 0 && searchQuery && (
            <div className="px-6 py-10 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-600 mb-3">
                <Search className="w-6 h-6 opacity-20" />
              </div>
              <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">No tools match</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2 mt-auto">

          <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 transition-all">
            {theme === 'light' ? <Moon className="w-5 h-5 text-slate-500" /> : <Sun className="w-5 h-5 text-orange-400" />}
            {!isCollapsed && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
          </button>

          {isAdmin && (
            <button onClick={() => setShowAdmin(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 transition-all">
              <Settings className="w-5 h-5 text-slate-500" />
              {!isCollapsed && <span>Admin Console</span>}
            </button>
          )}

          <div className={`flex items-center gap-3 px-3 py-3 mt-2 rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-700 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            )}
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.displayName || 'User'}</p>
                <button onClick={handleLogout} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400">Sign Out</button>
              </div>
            )}
          </div>
        </div>

        <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-orange-500 shadow-sm z-[70] transition-colors">
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
      {isAdmin && <AdminConsoleModal isOpen={showAdmin} onClose={() => setShowAdmin(false)} />}
      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </>
  );
};
