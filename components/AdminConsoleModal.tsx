import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, LayoutDashboard, Shield, Terminal, History, Trash2, Plus,
  Loader2, UserPlus, Link2, Lightbulb, Wrench, Save, AlertCircle,
  Menu, ChevronUp, ChevronDown, ListOrdered, Edit3, Settings2,
  LayoutGrid, List, Check, RotateCcw, Presentation, UserCog, UserMinus,
  RefreshCw, LifeBuoy, GripVertical, Hash, Zap, SearchCheck, Wand2, Palette,
  Volume2, PenLine, ClipboardCheck, ShieldCheck, CreditCard, Tag, ListFilter,
  ShieldBan, Map, Search, SlidersHorizontal, Lock, Unlock
} from 'lucide-react';
import { collection, query, doc, onSnapshot, orderBy, limit, deleteDoc, setDoc, serverTimestamp, addDoc, updateDoc, getDocs, startAfter, where, type DocumentSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

import { SubscriptionTracker } from './SubscriptionTracker';
import { UnifiedToolSettingsModal } from './UnifiedToolSettingsModal';

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  page: string;
  adminOnly?: boolean;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'usage' | 'users' | 'navigation' | 'links' | 'directus' | 'rules' | 'subscriptions' | 'ideas'>('usage');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Shared Data ---
  const [usage, setUsage] = useState<any[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageHasMore, setUsageHasMore] = useState(false);
  const usageCursorRef = useRef<DocumentSnapshot | null>(null);

  // --- Usage Filters ---
  const [filterTool, setFilterTool] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterAI, setFilterAI] = useState<'all' | 'ai' | 'non-ai'>('all');

  const [users, setUsers] = useState<any[]>([]);
  const [navGroups, setNavGroups] = useState<NavGroup[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);

  // --- Drag and Drop State ---
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ groupIdx: number, itemIdx: number } | null>(null);

  // --- Module State: Links ---
  const [links, setLinks] = useState<any[]>([]);
  const [newLink, setNewLink] = useState({ name: '', url: '', category: 'Metabase', description: '' });
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // --- Module State: Directus Guides ---
  const [guides, setGuides] = useState<any[]>([]);
  const [newGuide, setNewGuide] = useState({ title: '', url: '', category: 'Slides', summary: '' });
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null);

  // --- Module State: Nav Editor ---
  const [newItemData, setNewItemData] = useState<Record<string, { label: string, icon: string, page: string }>>({});

  // --- Module State: User Management ---
  const [manualUser, setManualUser] = useState({ email: '', displayName: '', role: 'user' });

  // --- Module State: Tool Config Settings ---
  const [openSettingsToolId, setOpenSettingsToolId] = useState<string | null>(null);

  // --- Module State: Ideas & Fixes ---
  const [ideas, setIdeas] = useState<any[]>([]);
  const [ideasTypeFilter, setIdeasTypeFilter] = useState<'all' | 'idea' | 'fix'>('all');
  const [ideasStatusFilter, setIdeasStatusFilter] = useState<string>('all');
  const [ideasSearch, setIdeasSearch] = useState('');
  const [ideasSort, setIdeasSort] = useState<'newest' | 'oldest'>('newest');
  const [ideasView, setIdeasView] = useState<'card' | 'list'>('card');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const unsubscribes: (() => void)[] = [];

    unsubscribes.push(onSnapshot(query(collection(db, 'users'), orderBy('lastLogin', 'desc')), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubscribes.push(onSnapshot(doc(db, 'navigation', 'sidebar_config'), (snap) => {
      if (snap.exists()) {
        setNavGroups(snap.data().groups || []);
      } else {
        setNavGroups([]);
      }
      setLoading(false);
    }, (err) => {
      console.error("Nav listener error:", err);
      setLoading(false);
    }));

    unsubscribes.push(onSnapshot(query(collection(db, 'resource_links'), orderBy('name', 'asc')), (snap) => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubscribes.push(onSnapshot(query(collection(db, 'directus_guides'), orderBy('title', 'asc')), (snap) => {
      setGuides(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubscribes.push(onSnapshot(collection(db, 'configurations'), (snap) => {
      setConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubscribes.push(onSnapshot(query(collection(db, 'tool_ideas'), orderBy('timestamp', 'desc')), (snap) => {
      setIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [isOpen]);

  const PAGE_SIZE = 50;

  const fetchUsage = useCallback(async (append = false) => {
    setUsageLoading(true);
    try {
      const constraints: any[] = [orderBy('timestamp', 'desc'), limit(PAGE_SIZE + 1)];
      if (filterTool.trim()) constraints.push(where('tool_id', '==', filterTool.trim()));
      if (filterUser.trim()) constraints.push(where('userEmail', '==', filterUser.trim()));
      if (filterAI === 'ai') constraints.push(where('is_ai_tool', '==', true));
      if (filterAI === 'non-ai') constraints.push(where('is_ai_tool', '==', false));
      if (append && usageCursorRef.current) constraints.push(startAfter(usageCursorRef.current));

      const snap = await getDocs(query(collection(db, 'usage'), ...constraints));
      const docs = snap.docs.slice(0, PAGE_SIZE);
      const items = docs.map(d => ({ id: d.id, ...d.data() }));

      usageCursorRef.current = docs[docs.length - 1] ?? null;
      setUsageHasMore(snap.docs.length > PAGE_SIZE);
      setUsage(prev => append ? [...prev, ...items] : items);
    } catch (e) {
      console.error('Failed to fetch usage', e);
    } finally {
      setUsageLoading(false);
    }
  }, [filterTool, filterUser, filterAI]);

  useEffect(() => {
    if (!isOpen) return;
    usageCursorRef.current = null;
    fetchUsage(false);
  }, [isOpen, filterTool, filterUser, filterAI, fetchUsage]);

  const saveNavigation = async (updatedGroups: NavGroup[]) => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'navigation', 'sidebar_config'), {
        groups: updatedGroups,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      alert("Save failed: Check permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const repairNavigation = async () => {
    if (!confirm("This will overwrite your current menu with the standard toolkit defaults. Proceed?")) return;

    setIsSaving(true);
    const initialConfig: NavGroup[] = [
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

    try {
      await saveNavigation(initialConfig);
    } catch (e: any) {
      console.error("Repair operation failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragGroupStart = (index: number) => {
    setDraggedGroupIndex(index);
    setDraggedItem(null);
  };

  const handleDragItemStart = (groupIdx: number, itemIdx: number) => {
    setDraggedItem({ groupIdx, itemIdx });
    setDraggedGroupIndex(null);
  };

  const handleGroupDrop = (targetIdx: number) => {
    if (draggedGroupIndex === null) return;
    const updated = [...navGroups];
    const [removed] = updated.splice(draggedGroupIndex, 1);
    updated.splice(targetIdx, 0, removed);
    setNavGroups(updated);
    saveNavigation(updated);
    setDraggedGroupIndex(null);
  };

  const handleItemDrop = (targetGroupIdx: number, targetItemIdx: number) => {
    if (!draggedItem) return;
    const updated = [...navGroups];
    const sourceGroup = updated[draggedItem.groupIdx];
    const targetGroup = updated[targetGroupIdx];

    const [removed] = sourceGroup.items.splice(draggedItem.itemIdx, 1);
    targetGroup.items.splice(targetItemIdx, 0, removed);

    setNavGroups(updated);
    saveNavigation(updated);
    setDraggedItem(null);
  };

  const handleAddUser = async () => {
    if (!manualUser.email) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'users'), {
        ...manualUser,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      setManualUser({ email: '', displayName: '', role: 'user' });
    } catch (e) { alert("Failed to add user"); } finally { setIsSaving(false); }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (e) { alert("Update failed"); }
  };

  const addNewNavItem = async (groupId: string) => {
    const data = newItemData[groupId];
    if (!data?.label || !data?.page) return;
    const updated = navGroups.map(g => g.id === groupId ? { ...g, items: [...g.items, { id: Math.random().toString(36).substr(2, 9), ...data }] } : g);
    setNavGroups(updated);
    setNewItemData(prev => ({ ...prev, [groupId]: { label: '', icon: '', page: '' } }));
    await saveNavigation(updated);
  };

  const deleteNavItem = async (groupId: string, itemId: string) => {
    if (!confirm("Delete this tool from the menu?")) return;
    const updated = navGroups.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g);
    setNavGroups(updated);
    await saveNavigation(updated);
  };

  const handleSaveLink = async () => {
    if (!newLink.name || !newLink.url) return;
    setIsSaving(true);
    try {
      if (editingLinkId) {
        await updateDoc(doc(db, 'resource_links', editingLinkId), { ...newLink, updatedAt: serverTimestamp() });
        setEditingLinkId(null);
      } else {
        await addDoc(collection(db, 'resource_links'), { ...newLink, createdAt: serverTimestamp() });
      }
      setNewLink({ name: '', url: '', category: 'Metabase', description: '' });
    } catch (e) { alert("Save failed"); } finally { setIsSaving(false); }
  };

  const handleSaveGuide = async () => {
    if (!newGuide.title || !newGuide.url) return;
    setIsSaving(true);
    try {
      if (editingGuideId) {
        await updateDoc(doc(db, 'directus_guides', editingGuideId), { ...newGuide, updatedAt: serverTimestamp() });
        setEditingGuideId(null);
      } else {
        await addDoc(collection(db, 'directus_guides'), { ...newGuide, createdAt: serverTimestamp() });
      }
      setNewGuide({ title: '', url: '', category: 'Slides', summary: '' });
    } catch (e) { alert("Save failed"); } finally { setIsSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-50 dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-[90vh] border dark:border-slate-800">

        <div className="px-6 py-5 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-orange-500" />
            <h3 className="text-xl font-bold dark:text-white">Admin Hub</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2"><X className="w-6 h-6" /></button>
        </div>

        <div className="px-6 border-b dark:border-slate-800 bg-white dark:bg-[#0f172a] flex space-x-6 overflow-x-auto scrollbar-hide">
          {[
            { id: 'usage', icon: LayoutDashboard, label: 'Usage' },
            { id: 'users', icon: UserPlus, label: 'Users' },
            { id: 'navigation', icon: ListOrdered, label: 'Nav Editor' },
            { id: 'links', icon: Link2, label: 'Links' },
            { id: 'directus', icon: Presentation, label: 'Directus' },
            { id: 'rules', icon: Terminal, label: 'Tool Configs' },
            { id: 'subscriptions', icon: CreditCard, label: 'Subscriptions' },
        { id: 'ideas', icon: Lightbulb, label: 'Ideas & Fixes' }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-[#0b1120] custom-scrollbar">

          {activeTab === 'usage' && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 shadow-sm flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    value={filterTool}
                    onChange={e => setFilterTool(e.target.value)}
                    placeholder="Filter by tool ID…"
                    className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs w-full dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    value={filterUser}
                    onChange={e => setFilterUser(e.target.value)}
                    placeholder="Filter by email…"
                    className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs w-full dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-lg border dark:border-slate-700 overflow-hidden text-xs font-bold">
                  {(['all', 'ai', 'non-ai'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setFilterAI(v)}
                      className={`px-3 py-1.5 transition-colors ${filterAI === v ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                      {v === 'all' ? 'All' : v === 'ai' ? 'AI' : 'Non-AI'}
                    </button>
                  ))}
                </div>
                {(filterTool || filterUser || filterAI !== 'all') && (
                  <button
                    onClick={() => { setFilterTool(''); setFilterUser(''); setFilterAI('all'); }}
                    className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Tool</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {usage.length === 0 && !usageLoading && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-400">No usage records match the current filters.</td></tr>
                    )}
                    {usage.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                        <td className="px-6 py-3 text-xs dark:text-slate-300">{u.userEmail}</td>
                        <td className="px-6 py-3 dark:text-slate-300 font-bold text-xs">{u.tool_name ?? u.tool}</td>
                        <td className="px-6 py-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${u.is_ai_tool ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                            {u.is_ai_tool ? 'AI' : 'Tool'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${u.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                            {u.status ?? 'success'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-xs dark:text-slate-400">{u.timestamp?.toDate().toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination footer */}
                {(usageHasMore || usageLoading) && (
                  <div className="px-6 py-4 border-t dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{usage.length} records loaded</span>
                    <button
                      onClick={() => fetchUsage(true)}
                      disabled={usageLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {usageLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      See more
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm">
                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Manual User Registration</h4>
                <div className="flex flex-wrap gap-4">
                  <input placeholder="Full Name" value={manualUser.displayName} onChange={e => setManualUser({ ...manualUser, displayName: e.target.value })} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-4 py-2 text-sm flex-1 dark:text-white" />
                  <input placeholder="Email" value={manualUser.email} onChange={e => setManualUser({ ...manualUser, email: e.target.value })} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-4 py-2 text-sm flex-1 dark:text-white" />
                  <select value={manualUser.role} onChange={e => setManualUser({ ...manualUser, role: e.target.value })} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-4 py-2 text-sm dark:text-white">
                    <option value="user">User</option><option value="admin">Admin</option>
                  </select>
                  <button onClick={handleAddUser} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md flex items-center gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Create User
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map(u => (
                  <div key={u.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 flex flex-col group hover:border-indigo-500/50 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-orange-500 border dark:border-slate-700">
                        {u.displayName?.[0] || u.email?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm dark:text-white truncate">{u.displayName || 'Unnamed User'}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                      <button onClick={() => { if (confirm("Permanently delete user record?")) deleteDoc(doc(db, 'users', u.id)); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 transition-all">
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700 mt-auto">
                      <select
                        value={u.role}
                        onChange={(e) => updateUserRole(u.id, e.target.value)}
                        className={`text-[9px] font-black uppercase px-2 py-1 rounded transition-colors ${u.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
                      >
                        <option value="user">User</option><option value="admin">Admin</option>
                      </select>
                      <span className="text-[8px] text-slate-400 font-bold uppercase">Active</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'navigation' && (
            <div className="space-y-6 animate-fade-in">
              {/* Reset Defaults Bar */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 mb-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <ListOrdered className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold dark:text-white">Sidebar Menu Editor</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Drag items to reorder. Resetting will restore all default toolkit tools.</p>
                  </div>
                </div>
                <button
                  onClick={repairNavigation}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reset to Defaults
                </button>
              </div>

              {navGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <LifeBuoy className="w-16 h-16 text-slate-300 mb-4 animate-bounce" />
                  <h4 className="text-lg font-bold dark:text-white">Menu Configuration Empty</h4>
                  <p className="text-sm text-slate-500 mb-6">Initialize the default sidebar menu structure below.</p>
                  <button
                    onClick={repairNavigation}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xl transition-all active:scale-95"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    Initialize Navigation
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {navGroups.map((group, gIdx) => (
                    <div
                      key={group.id}
                      className={`bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-hidden shadow-sm transition-all ${draggedGroupIndex === gIdx ? 'opacity-40 scale-[0.98]' : ''}`}
                      draggable
                      onDragStart={() => handleDragGroupStart(gIdx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleGroupDrop(gIdx)}
                    >
                      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{group.title}</span>
                        </div>
                        <button className="text-slate-400 hover:text-indigo-500"><Edit3 className="w-3.5 h-3.5" /></button>
                      </div>

                      <div className="p-4 space-y-2">
                        {group.items.map((item, iIdx) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border dark:border-slate-700 group transition-all ${draggedItem?.groupIdx === gIdx && draggedItem?.itemIdx === iIdx ? 'opacity-30' : 'hover:border-indigo-200 dark:hover:border-indigo-900/50'}`}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              handleDragItemStart(gIdx, iIdx);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.stopPropagation();
                              handleItemDrop(gIdx, iIdx);
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="cursor-grab active:cursor-grabbing text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                              <Terminal className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-bold dark:text-slate-200 truncate">{item.label}</span>
                              <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-500 uppercase">ID: {item.page}</span>
                            </div>
                            <button onClick={() => deleteNavItem(group.id, item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2 border-t dark:border-slate-700 pt-4">
                          <input placeholder="Label" value={newItemData[group.id]?.label || ''} onChange={e => setNewItemData({ ...newItemData, [group.id]: { ...newItemData[group.id], label: e.target.value } })} className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-xs dark:text-white" />
                          <input placeholder="Icon (Lucide)" value={newItemData[group.id]?.icon || ''} onChange={e => setNewItemData({ ...newItemData, [group.id]: { ...newItemData[group.id], icon: e.target.value } })} className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-xs dark:text-white" />
                          <input placeholder="Page ID" value={newItemData[group.id]?.page || ''} onChange={e => setNewItemData({ ...newItemData, [group.id]: { ...newItemData[group.id], page: e.target.value } })} className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-xs dark:text-white" />
                          <button onClick={() => addNewNavItem(group.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold py-2 transition-colors">Add Tool</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'links' && (
            <div className="space-y-6 animate-fade-in">
              <div id="link-form" className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{editingLinkId ? 'Edit Link' : 'Add Link'}</h4>
                  {editingLinkId && <button onClick={() => setEditingLinkId(null)} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Cancel</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <input value={newLink.name} onChange={e => setNewLink({ ...newLink, name: e.target.value })} placeholder="Title" className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                  <input value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} placeholder="URL" className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                  <select value={newLink.category} onChange={e => setNewLink({ ...newLink, category: e.target.value })} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white"><option>Metabase</option><option>Curriculum</option><option>Tech</option></select>
                  <button onClick={handleSaveLink} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold py-2 text-sm shadow-md transition-all">Save Resource</button>
                </div>
                <textarea value={newLink.description} onChange={e => setNewLink({ ...newLink, description: e.target.value })} placeholder="Summary..." rows={2} className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-3 text-sm dark:text-white resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {links.map(l => (
                  <div key={l.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 group relative">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 block">{l.category}</span>
                    <h5 className="font-bold text-sm dark:text-white truncate">{l.name}</h5>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{l.description}</p>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditingLinkId(l.id); setNewLink({ name: l.name, url: l.url, category: l.category, description: l.description }); }} className="p-1.5 text-slate-400 hover:text-teal-500"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteDoc(doc(db, 'resource_links', l.id))} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'directus' && (
            <div className="space-y-6 animate-fade-in">
              <div id="guide-form" className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{editingGuideId ? 'Edit Guide' : 'Add Guide'}</h4>
                  {editingGuideId && <button onClick={() => setEditingGuideId(null)} className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Cancel</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <input value={newGuide.title} onChange={e => setNewGuide({ ...newGuide, title: e.target.value })} placeholder="Title" className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                  <input value={newGuide.url} onChange={e => setNewGuide({ ...newGuide, url: e.target.value })} placeholder="URL" className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                  <select value={newGuide.category} onChange={e => setNewGuide({ ...newGuide, category: e.target.value })} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white"><option>Slides</option><option>Media</option><option>Admin</option></select>
                  <button onClick={handleSaveGuide} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold py-2 text-sm shadow-md transition-all">Save Guide</button>
                </div>
                <textarea value={newGuide.summary} onChange={e => setNewGuide({ ...newGuide, summary: e.target.value })} placeholder="Instructions..." rows={2} className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-3 text-sm dark:text-white resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {guides.map(g => (
                  <div key={g.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 group relative">
                    <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-1 block">{g.category}</span>
                    <h5 className="font-bold text-sm dark:text-white truncate">{g.title}</h5>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{g.summary}</p>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditingGuideId(g.id); setNewGuide({ title: g.title, url: g.url, category: g.category, summary: g.summary }); }} className="p-1.5 text-slate-400 hover:text-indigo-500"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteDoc(doc(db, 'directus_guides', g.id))} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4 animate-fade-in">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Live Tool Configs</h4>
              {configs.map(c => (
                <div key={c.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg text-orange-500"><Settings2 className="w-4 h-4" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-sm capitalize dark:text-white">{c.id.replace(/-/g, ' ')}</h5>
                        {c.isLocked
                          ? <span className="flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800"><Lock className="w-2.5 h-2.5" />Locked</span>
                          : <span className="flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500"><Unlock className="w-2.5 h-2.5" />Unlocked</span>
                        }
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : 'System'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOpenSettingsToolId(c.id)} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100">Open Settings</button>
                    <button onClick={() => deleteDoc(doc(db, 'configurations', c.id))} className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {openSettingsToolId && (
            <UnifiedToolSettingsModal
              toolId={openSettingsToolId}
              isOpen={Boolean(openSettingsToolId)}
              onClose={() => setOpenSettingsToolId(null)}
              defaultPrompt=""
              toolLabel={openSettingsToolId.replace(/-/g, ' ')}
            />
          )}

          {activeTab === 'subscriptions' && (
            <div className="animate-fade-in">
              <SubscriptionTracker />
            </div>
          )}

          {activeTab === 'ideas' && (() => {
            const STATUS_OPTIONS = ['New', 'In Review', 'Done', 'Rejected'];
            const STATUS_STYLES: Record<string, string> = {
              'New': 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
              'In Review': 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
              'Done': 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
              'Rejected': 'bg-slate-100 dark:bg-slate-700 text-slate-500',
            };
            const filtered = ideas
              .filter(i => ideasTypeFilter === 'all' || i.type === ideasTypeFilter)
              .filter(i => ideasStatusFilter === 'all' || i.status === ideasStatusFilter)
              .filter(i => !ideasSearch || i.text?.toLowerCase().includes(ideasSearch.toLowerCase()) || i.userName?.toLowerCase().includes(ideasSearch.toLowerCase()))
              .sort((a, b) => {
                const ta = a.timestamp?.toMillis?.() ?? 0;
                const tb = b.timestamp?.toMillis?.() ?? 0;
                return ideasSort === 'newest' ? tb - ta : ta - tb;
              });

            const updateStatus = async (id: string, status: string) => {
              try { await updateDoc(doc(db, 'tool_ideas', id), { status }); } catch (e) { alert('Update failed'); }
            };
            const deleteIdea = async (id: string) => {
              if (confirm('Delete this entry?')) try { await deleteDoc(doc(db, 'tool_ideas', id)); } catch (e) { alert('Delete failed'); }
            };

            return (
              <div className="space-y-5 animate-fade-in">
                {/* Toolbar */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 shadow-sm flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
                    {(['all', 'idea', 'fix'] as const).map(t => (
                      <button key={t} onClick={() => setIdeasTypeFilter(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                          ideasTypeFilter === t ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        {t === 'all' ? 'All' : t === 'idea' ? '💡 Ideas' : '🔧 Fixes'}
                      </button>
                    ))}
                  </div>
                  <select value={ideasStatusFilter} onChange={e => setIdeasStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold dark:text-white">
                    <option value="all">All Statuses</option>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input value={ideasSearch} onChange={e => setIdeasSearch(e.target.value)}
                      placeholder="Search text or user…"
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl text-xs dark:text-white" />
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={() => setIdeasSort(s => s === 'newest' ? 'oldest' : 'newest')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                      <SlidersHorizontal className="w-3.5 h-3.5" />{ideasSort === 'newest' ? 'Newest' : 'Oldest'}
                    </button>
                    <button onClick={() => setIdeasView(v => v === 'card' ? 'list' : 'card')}
                      className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                      {ideasView === 'card' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</p>

                {filtered.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No entries match your filters.</p>
                  </div>
                )}

                {ideasView === 'card' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(idea => (
                      <div key={idea.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm group flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                            {(idea.userName || idea.userEmail || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold dark:text-white truncate">{idea.userName || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400 truncate">{idea.userEmail}</p>
                          </div>
                          <div className="ml-auto flex gap-1 shrink-0">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              idea.type === 'fix' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600'
                            }`}>{idea.type === 'fix' ? 'Fix' : 'Idea'}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">{idea.text}</p>
                        <div className="flex items-center justify-between pt-2 border-t dark:border-slate-700">
                          <select value={idea.status || 'New'} onChange={e => updateStatus(idea.id, e.target.value)}
                            className={`text-[9px] font-black uppercase px-2 py-1 rounded border-0 cursor-pointer ${STATUS_STYLES[idea.status || 'New']} bg-transparent`}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-400 font-mono">{idea.timestamp?.toDate?.()?.toLocaleDateString() || '—'}</span>
                            <button onClick={() => deleteIdea(idea.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Text</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-700">
                        {filtered.map(idea => (
                          <tr key={idea.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 group">
                            <td className="px-4 py-3">
                              <p className="text-xs font-bold dark:text-white">{idea.userName || '—'}</p>
                              <p className="text-[10px] text-slate-400">{idea.userEmail}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                idea.type === 'fix' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600'
                              }`}>{idea.type === 'fix' ? 'Fix' : 'Idea'}</span>
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              <p className="text-xs dark:text-slate-300 line-clamp-2">{idea.text}</p>
                            </td>
                            <td className="px-4 py-3">
                              <select value={idea.status || 'New'} onChange={e => updateStatus(idea.id, e.target.value)}
                                className={`text-[9px] font-black uppercase px-2 py-1 rounded cursor-pointer border-0 ${STATUS_STYLES[idea.status || 'New']}`}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-[10px] text-slate-400 font-mono whitespace-nowrap">
                              {idea.timestamp?.toDate?.()?.toLocaleDateString() || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => deleteIdea(idea.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
};