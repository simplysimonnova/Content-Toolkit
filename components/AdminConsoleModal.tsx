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
import { db, auth } from '../services/firebase';

import { SubscriptionTracker } from './SubscriptionTracker';
import { UnifiedToolSettingsModal } from './UnifiedToolSettingsModal';
import { ENGINE_VERSION } from '../services/qaEngineV1';

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
  const [activeTab, setActiveTab] = useState<'usage' | 'users' | 'navigation' | 'links' | 'directus' | 'rules' | 'subscriptions' | 'ideas' | 'ai-tools' | 'qa-modules' | 'qa-config' | 'qa-dashboard'>('usage');
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

  // --- Module State: AI Tool Settings ---
  const [toolSettings, setToolSettings] = useState<Record<string, string>>({});
  const [toolSettingsSaving, setToolSettingsSaving] = useState<string | null>(null);

  // --- Module State: Ideas & Fixes ---
  const [ideas, setIdeas] = useState<any[]>([]);
  const [ideasTypeFilter, setIdeasTypeFilter] = useState<'all' | 'idea' | 'fix'>('all');
  const [ideasStatusFilter, setIdeasStatusFilter] = useState<string>('all');
  const [ideasSearch, setIdeasSearch] = useState('');
  const [ideasSort, setIdeasSort] = useState<'newest' | 'oldest'>('newest');
  const [ideasView, setIdeasView] = useState<'card' | 'list'>('card');

  // --- QA Engine v1 State ---
  const [qaModules, setQaModules] = useState<any[]>([]);
  const [qaConfig, setQaConfig] = useState<any>(null);
  const [qaConfigHistory, setQaConfigHistory] = useState<any[]>([]);
  const [qaRuns, setQaRuns] = useState<any[]>([]);
  const [qaProofreadingRuns, setQaProofreadingRuns] = useState<any[]>([]);
  const [qaDesignRuns, setQaDesignRuns] = useState<any[]>([]);
  const [qaSnapshots, setQaSnapshots] = useState<any[]>([]);
  const [qaModuleForm, setQaModuleForm] = useState({ name: '', academic_focus: '', ai_prompt: '', active: true });
  const [qaModuleEditId, setQaModuleEditId] = useState<string | null>(null);
  const [qaConfigForm, setQaConfigForm] = useState({ stage1_min_score: 35, stage2_min_score: 38, version: '' });
  const [isSavingQA, setIsSavingQA] = useState(false);
  const [triggerWindow, setTriggerWindow] = useState<'30' | '60' | '90'>('30');

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

    unsubscribes.push(onSnapshot(collection(db, 'tool_settings'), (snap) => {
      const settings: Record<string, string> = {};
      snap.docs.forEach(d => { settings[d.id] = d.data().capabilityTier || 'default'; });
      setToolSettings(settings);
    }));

    // QA Engine v1 collections
    unsubscribes.push(onSnapshot(query(collection(db, 'qa_modules'), orderBy('name', 'asc')), (snap) => {
      setQaModules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubscribes.push(onSnapshot(query(collection(db, 'qa_config_v1'), orderBy('updated_at', 'desc')), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, any>));
      setQaConfig(all.find(c => c['active']) ?? null);
      setQaConfigHistory(all);
    }));
    unsubscribes.push(onSnapshot(query(collection(db, 'qa_runs_v1'), where('engine_version', '==', ENGINE_VERSION), orderBy('timestamp', 'desc'), limit(200)), (snap) => {
      setQaRuns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubscribes.push(onSnapshot(query(collection(db, 'qa_proofreading_runs_v1'), where('engine_version', '==', ENGINE_VERSION), orderBy('timestamp', 'desc'), limit(200)), (snap) => {
      setQaProofreadingRuns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubscribes.push(onSnapshot(query(collection(db, 'qa_design_runs_v1'), where('engine_version', '==', ENGINE_VERSION), orderBy('timestamp', 'desc'), limit(200)), (snap) => {
      setQaDesignRuns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubscribes.push(onSnapshot(query(collection(db, 'qa_snapshots'), where('engine_version', '==', ENGINE_VERSION), orderBy('created_at', 'desc'), limit(200)), (snap) => {
      setQaSnapshots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
          { id: 'lc3', label: 'Slide-creator Studio', icon: 'FileText', page: 'slide-creator' },
          { id: 'lc4', label: 'TN Standardiser', icon: 'BookOpen', page: 'tn-standardiser' },
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
          { id: 'vq4', label: 'QA Engine V1', icon: 'ShieldCheck', page: 'slides-zip-upload' }
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
          { id: 'u3', label: 'VR Validator', icon: 'Map', page: 'vr-validator' },
          { id: 'u4', label: 'CSV Cleanroom', icon: 'Filter', page: 'csv-cleanroom' }
        ]
      },
      {
        id: 'resources',
        title: 'Resources',
        items: [
          { id: 'r0', label: 'Toolkit Info', icon: 'Compass', page: 'toolkit-info' },
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
            { id: 'ideas', icon: Lightbulb, label: 'Ideas & Fixes' },
            { id: 'ai-tools', icon: Wand2, label: 'AI Tool Settings' },
            { id: 'qa-modules', icon: ClipboardCheck, label: 'QA Modules' },
            { id: 'qa-config', icon: SlidersHorizontal, label: 'QA Config' },
            { id: 'qa-dashboard', icon: ShieldCheck, label: 'QA Dashboard' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-[#0b1120] custom-scrollbar">

          {activeTab === 'usage' && (
            <div className="space-y-4">
              {/* Tier cost summary */}
              {(() => {
                const aiRuns = usage.filter(u => u.is_ai_tool);
                const flashRuns = aiRuns.filter(u => u.tier !== 'reasoning').length;
                const proRuns = aiRuns.filter(u => u.tier === 'reasoning').length;
                const totalCostUnits = aiRuns.reduce((sum, u) => sum + (u.cost_units ?? 1), 0);
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Flash Runs</p>
                      <p className="text-2xl font-black text-slate-700 dark:text-slate-100">{flashRuns}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pro Runs</p>
                      <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{proRuns}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Cost Units</p>
                      <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalCostUnits}</p>
                    </div>
                  </div>
                );
              })()}
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
            const STATUS_OPTIONS = ['new', 'reviewed', 'actioned'];
            const STATUS_STYLES: Record<string, string> = {
              'new': 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
              'reviewed': 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
              'actioned': 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${ideasTypeFilter === t ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'
                          }`}>
                        {t === 'all' ? 'All' : t === 'idea' ? '💡 Ideas' : '🔧 Fixes'}
                      </button>
                    ))}
                  </div>
                  <select value={ideasStatusFilter} onChange={e => setIdeasStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold dark:text-white capitalize">
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
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${idea.type === 'fix' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600'
                              }`}>{idea.type === 'fix' ? 'Fix' : 'Idea'}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">{idea.text}</p>
                        {idea.linkedTaskUrl && (
                          <a href={idea.linkedTaskUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[10px] text-indigo-500 hover:text-indigo-600 font-mono truncate">
                            <Link2 className="w-3 h-3 shrink-0" />{idea.linkedTaskUrl}
                          </a>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t dark:border-slate-700">
                          <select value={(idea.status || 'new').toLowerCase()} onChange={e => updateStatus(idea.id, e.target.value)}
                            className={`text-[9px] font-black uppercase px-2 py-1 rounded border-0 cursor-pointer ${STATUS_STYLES[(idea.status || 'new').toLowerCase()] ?? STATUS_STYLES['new']} bg-transparent`}>
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
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${idea.type === 'fix' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600'
                                }`}>{idea.type === 'fix' ? 'Fix' : 'Idea'}</span>
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              <p className="text-xs dark:text-slate-300 line-clamp-2">{idea.text}</p>
                              {idea.linkedTaskUrl && (
                                <a href={idea.linkedTaskUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-indigo-500 font-mono truncate mt-1">
                                  <Link2 className="w-3 h-3 shrink-0" />{idea.linkedTaskUrl}
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <select value={(idea.status || 'new').toLowerCase()} onChange={e => updateStatus(idea.id, e.target.value)}
                                className={`text-[9px] font-black uppercase px-2 py-1 rounded cursor-pointer border-0 ${STATUS_STYLES[(idea.status || 'new').toLowerCase()] ?? STATUS_STYLES['new']}`}>
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

          {activeTab === 'ai-tools' && (() => {
            const AI_TOOLS = [
              { id: 'lesson-descriptions', label: 'Lesson Descriptions' },
              { id: 'taf-generator', label: 'TAF Generator' },
              { id: 'tn-standardiser', label: 'TN Standardiser' },
              { id: 'tn-fixer', label: 'TN Fixer Module' },
              { id: 'proofing-bot', label: 'General Proofing Bot' },
              { id: 'llm-content-checker', label: 'LLM Content Checker' },
              { id: 'thematic-qa', label: 'Thematic QA' },
              { id: 'lesson-qa', label: 'Lesson QA' },
              { id: 'jira-ticketer', label: 'Jira Ticketer' },
              { id: 'image-renamer', label: 'Image Renamer' },
              { id: 'topic-assigner', label: 'Topic Assigner' },
              { id: 'vr-validator', label: 'VR Validator' },
              { id: 'comp-import-creator', label: 'Competency Builder' },
              { id: 'competency-csv-normaliser', label: 'Competency CSV Normaliser' },
              { id: 'subscription-tracker', label: 'Subscription Tracker' },
              { id: 'prompt-rewriter', label: 'Image Prompt Rewriter' },
              { id: 'prompt-writer', label: 'Image Prompt Writer' },
            ];
            const TIER_OPTIONS: { value: string; label: string }[] = [
              { value: 'default', label: 'Default' },
              { value: 'reasoning', label: 'Reasoning' },
              { value: 'vision', label: 'Vision' },
            ];
            const TIER_STYLES: Record<string, string> = {
              default: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
              reasoning: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
              vision: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
            };
            const TIER_WARNINGS: Record<string, string | null> = {
              default: null,
              reasoning: '⚠ Reasoning tier uses higher-cost model.',
              vision: null,
            };
            const updateTier = async (toolId: string, tier: string) => {
              setToolSettingsSaving(toolId);
              try {
                await setDoc(doc(db, 'tool_settings', toolId), {
                  tool_id: toolId,
                  capabilityTier: tier,
                  updatedAt: serverTimestamp(),
                }, { merge: true });
                setToolSettings(prev => ({ ...prev, [toolId]: tier }));
              } catch (e) { console.error('Failed to update tier', e); }
              setToolSettingsSaving(null);
            };
            return (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 shadow-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Set the capability tier per tool. All tiers currently resolve to <span className="font-mono font-bold">gemini-3-flash-preview</span>. Future model upgrades require editing only <span className="font-mono font-bold">lib/modelRegistry.ts</span>.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Tool</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Tool ID</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Capability Tier</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700/50">
                      {AI_TOOLS.map(tool => {
                        const currentTier = toolSettings[tool.id] || 'default';
                        const isSaving = toolSettingsSaving === tool.id;
                        return (
                          <tr key={tool.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 text-xs">{tool.label}</td>
                            <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{tool.id}</td>
                            <td className="px-4 py-3">
                              <select
                                value={currentTier}
                                onChange={e => updateTier(tool.id, e.target.value)}
                                disabled={isSaving}
                                className={`text-[10px] font-black uppercase px-2 py-1 rounded border-0 cursor-pointer ${TIER_STYLES[currentTier] ?? TIER_STYLES.default}`}
                              >
                                {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              {TIER_WARNINGS[currentTier] && (
                                <p className="text-[9px] text-amber-500 dark:text-amber-400 mt-1">{TIER_WARNINGS[currentTier]}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isSaving
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                : <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ============================================================ */}
          {/* QA MODULES TAB                                               */}
          {/* ============================================================ */}
          {activeTab === 'qa-modules' && (() => {
            const saveModule = async () => {
              if (!qaModuleForm.name || !qaModuleForm.ai_prompt) return;
              setIsSavingQA(true);
              try {
                const payload = {
                  ...qaModuleForm,
                  triggers: [],
                  version: 1,
                  updated_by: auth.currentUser?.uid ?? 'admin',
                  created_at: serverTimestamp(),
                };
                if (qaModuleEditId) {
                  await updateDoc(doc(db, 'qa_modules', qaModuleEditId), { ...qaModuleForm, updated_at: serverTimestamp() });
                  setQaModuleEditId(null);
                } else {
                  await addDoc(collection(db, 'qa_modules'), payload);
                }
                setQaModuleForm({ name: '', academic_focus: '', ai_prompt: '', active: true });
              } catch (e) { alert('Save failed'); }
              finally { setIsSavingQA(false); }
            };
            const deactivateModule = async (id: string) => {
              if (!confirm('Deactivate this module? It will no longer be selectable for new lessons.')) return;
              await updateDoc(doc(db, 'qa_modules', id), { active: false, updated_at: serverTimestamp() });
            };
            return (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">⚠ Admin Only — Modules define scoring prompts and trigger definitions for lessons. Changes affect all future QA runs for lessons using this module.</p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{qaModuleEditId ? 'Edit Module' : 'Create Module'}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Module Name</label>
                      <input value={qaModuleForm.name} onChange={e => setQaModuleForm({ ...qaModuleForm, name: e.target.value })} placeholder="e.g. Core English Lesson" className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Academic Focus</label>
                      <input value={qaModuleForm.academic_focus} onChange={e => setQaModuleForm({ ...qaModuleForm, academic_focus: e.target.value })} placeholder="e.g. Speaking & Vocabulary" className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">AI Evaluation Prompt</label>
                    <textarea value={qaModuleForm.ai_prompt} onChange={e => setQaModuleForm({ ...qaModuleForm, ai_prompt: e.target.value })} rows={5} placeholder="System instruction for the AI reviewer..." className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-3 text-sm dark:text-white resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={saveModule} disabled={isSavingQA} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md">
                      {isSavingQA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {qaModuleEditId ? 'Update Module' : 'Create Module'}
                    </button>
                    {qaModuleEditId && <button onClick={() => { setQaModuleEditId(null); setQaModuleForm({ name: '', academic_focus: '', ai_prompt: '', active: true }); }} className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-red-500">Cancel</button>}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{qaModules.length} module{qaModules.length !== 1 ? 's' : ''}</p>
                  {qaModules.map(m => (
                    <div key={m.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border dark:border-slate-700 flex items-start justify-between gap-4 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${m.active !== false ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-400'}`}>{m.active !== false ? 'Active' : 'Inactive'}</span>
                          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">v{m.version ?? 1}</span>
                        </div>
                        <h5 className="font-bold text-sm dark:text-white">{m.name}</h5>
                        <p className="text-xs text-slate-500 mt-0.5">{m.academic_focus}</p>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 font-mono">{m.ai_prompt?.slice(0, 120)}…</p>
                        <p className="text-[9px] text-slate-400 mt-1">{(m.triggers ?? []).length} trigger definitions</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => { setQaModuleEditId(m.id); setQaModuleForm({ name: m.name, academic_focus: m.academic_focus ?? '', ai_prompt: m.ai_prompt ?? '', active: m.active !== false }); }} className="p-2 text-slate-400 hover:text-indigo-500"><Edit3 className="w-4 h-4" /></button>
                        {m.active !== false && <button onClick={() => deactivateModule(m.id)} className="p-2 text-slate-400 hover:text-red-500"><ShieldBan className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ============================================================ */}
          {/* QA CONFIG TAB (Versioned Thresholds)                         */}
          {/* ============================================================ */}
          {activeTab === 'qa-config' && (() => {
            const saveNewConfig = async () => {
              if (!qaConfigForm.version.trim()) return alert('Version tag is required (e.g. v1.1)');
              setIsSavingQA(true);
              try {
                // Mark current active as inactive
                if (qaConfig?.id) await updateDoc(doc(db, 'qa_config_v1', qaConfig.id), { active: false });
                await addDoc(collection(db, 'qa_config_v1'), {
                  ...qaConfigForm,
                  active: true,
                  updated_by: auth.currentUser?.uid ?? 'admin',
                  updated_at: serverTimestamp(),
                });
                setQaConfigForm({ stage1_min_score: 35, stage2_min_score: 38, version: '' });
              } catch (e) { alert('Save failed'); }
              finally { setIsSavingQA(false); }
            };
            return (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">⚠ Changing thresholds creates a new versioned config entry. Historical QA runs are unaffected — each run captures the threshold version at time of execution.</p>
                </div>

                {/* Active config */}
                {qaConfig ? (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">Active</span>
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{qaConfig.version}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-center">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Stage 1 Min</p>
                        <p className="text-3xl font-black text-indigo-600">{qaConfig.stage1_min_score}<span className="text-sm text-slate-400">/50</span></p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-center">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Stage 2 Min</p>
                        <p className="text-3xl font-black text-indigo-600">{qaConfig.stage2_min_score}<span className="text-sm text-slate-400">/50</span></p>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-3">Updated by {qaConfig.updated_by} · {qaConfig.updated_at?.toDate?.()?.toLocaleString?.() ?? '—'}</p>
                  </div>
                ) : (
                  <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                    <p className="text-sm font-bold text-orange-700 dark:text-orange-400">⚠ No active QA threshold config. Create one below — QA runs will fail without it.</p>
                  </div>
                )}

                {/* Create new config */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Set New Thresholds</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Stage 1 Min Score (0–50)</label>
                      <input type="number" min={0} max={50} value={qaConfigForm.stage1_min_score} onChange={e => setQaConfigForm({ ...qaConfigForm, stage1_min_score: Number(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Stage 2 Min Score (0–50)</label>
                      <input type="number" min={0} max={50} value={qaConfigForm.stage2_min_score} onChange={e => setQaConfigForm({ ...qaConfigForm, stage2_min_score: Number(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Version Tag</label>
                      <input value={qaConfigForm.version} onChange={e => setQaConfigForm({ ...qaConfigForm, version: e.target.value })} placeholder="e.g. v1.1" className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm dark:text-white" />
                    </div>
                  </div>
                  <button onClick={saveNewConfig} disabled={isSavingQA} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md">
                    {isSavingQA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Publish New Config Version
                  </button>
                </div>

                {/* History */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Config History ({qaConfigHistory.length})</h4>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b dark:border-slate-700">
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400">Version</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400">Stage 1</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400">Stage 2</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400">Status</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {qaConfigHistory.map(c => (
                        <tr key={c.id} className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 ${c.active ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`}>
                          <td className="px-4 py-2.5 font-mono font-bold dark:text-white">{c.version}</td>
                          <td className="px-4 py-2.5 dark:text-slate-300">{c.stage1_min_score}/50</td>
                          <td className="px-4 py-2.5 dark:text-slate-300">{c.stage2_min_score}/50</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${c.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{c.active ? 'Active' : 'Archived'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 font-mono">{c.updated_at?.toDate?.()?.toLocaleDateString?.() ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ============================================================ */}
          {/* QA DASHBOARD TAB (Phase 1 — Read-only)                       */}
          {/* ============================================================ */}
          {activeTab === 'qa-dashboard' && (() => {
            const totalRuns = qaRuns.length;
            const revisionRuns = qaRuns.filter(r => r.status === 'revision-required').length;
            const passRuns = qaRuns.filter(r => r.status === 'pass').length;
            const revisionRate = totalRuns > 0 ? Math.round((revisionRuns / totalRuns) * 100) : 0;

            const avgCoreScore = totalRuns > 0
              ? Math.round(qaRuns.reduce((s, r) => s + (r.core_score ?? 0), 0) / totalRuns)
              : 0;
            const avgModuleScore = totalRuns > 0
              ? Math.round(qaRuns.reduce((s, r) => s + (r.module_score ?? 0), 0) / totalRuns)
              : 0;

            const seriousRuns = qaRuns.filter(r => r.serious_trigger_flag);
            const triggerFreq: Record<string, number> = {};
            seriousRuns.forEach(r => {
              (r.triggers ?? []).forEach((t: any) => {
                if (t.blocks_progression) triggerFreq[t.trigger_type] = (triggerFreq[t.trigger_type] ?? 0) + 1;
              });
            });
            const topTriggers = Object.entries(triggerFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

            // Phase 3 — Operational metrics
            const totalProofRuns = qaProofreadingRuns.length;
            const failedProofRuns = qaProofreadingRuns.filter(r => r.status === 'blocked').length;
            const avgStage3Ms = totalProofRuns > 0
              ? Math.round(qaProofreadingRuns.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / totalProofRuns)
              : 0;
            const stage3FailRate = totalProofRuns > 0 ? Math.round((failedProofRuns / totalProofRuns) * 100) : 0;

            const totalDesignRuns = qaDesignRuns.length;
            const failedDesignRuns = qaDesignRuns.filter(r => r.status === 'blocked').length;
            const avgStage4Ms = totalDesignRuns > 0
              ? Math.round(qaDesignRuns.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / totalDesignRuns)
              : 0;
            const stage4FailRate = totalDesignRuns > 0 ? Math.round((failedDesignRuns / totalDesignRuns) * 100) : 0;

            // Snapshot reuse rate: lessons that have a snapshot vs total unique lessons run
            const uniqueLessonsRun = new Set([...qaRuns, ...qaProofreadingRuns, ...qaDesignRuns].map(r => r.lesson_id)).size;
            const snapshotReuse = uniqueLessonsRun > 0
              ? Math.round((qaSnapshots.length / uniqueLessonsRun) * 100)
              : 0;

            return (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                  <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase tracking-widest">QA Engine v1 · Phase 3 Dashboard · Read-Only View</p>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Runs', value: totalRuns, color: 'text-slate-700 dark:text-slate-200' },
                    { label: 'Avg Core Score', value: `${avgCoreScore}/30`, color: 'text-indigo-600 dark:text-indigo-400' },
                    { label: 'Avg Module Score', value: `${avgModuleScore}/20`, color: 'text-indigo-600 dark:text-indigo-400' },
                    { label: 'Revision Rate', value: `${revisionRate}%`, color: revisionRate > 40 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
                  ].map(k => (
                    <div key={k.label} className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 shadow-sm text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{k.label}</p>
                      <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Serious trigger frequency */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Serious Trigger Frequency ({seriousRuns.length} runs affected)</h4>
                    </div>
                    {topTriggers.length === 0 ? (
                      <p className="px-5 py-6 text-xs text-slate-400 text-center">No serious triggers recorded.</p>
                    ) : (
                      <div className="p-4 space-y-2">
                        {topTriggers.map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-xs font-mono dark:text-slate-300 truncate">{type}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs font-black text-red-600 dark:text-red-400">{count}</span>
                              <div className="h-1.5 bg-red-200 dark:bg-red-900/40 rounded-full" style={{ width: `${Math.round((count / (seriousRuns.length || 1)) * 80)}px` }} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pass vs revision */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm">
                    <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Run Outcomes</h4>
                    </div>
                    <div className="p-5 space-y-3">
                      {[
                        { label: 'Passed', count: passRuns, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Revision Required', count: revisionRuns, color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
                      ].map(o => (
                        <div key={o.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold dark:text-slate-300">{o.label}</span>
                            <span className={`text-xs font-black ${o.textColor}`}>{o.count}</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-2 rounded-full transition-all ${o.color}`} style={{ width: totalRuns > 0 ? `${(o.count / totalRuns) * 100}%` : '0%' }} />
                          </div>
                        </div>
                      ))}
                      <p className="text-[9px] text-slate-400 pt-2 border-t dark:border-slate-700">
                        Note: Reviewer calibration, writer analytics, and bottleneck analysis are Phase 4 — requires Stage 3–5 data.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Phase 3 — Operational Health */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Operational Health — Stages 3 &amp; 4</h4>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Avg Stage 3 Duration', value: totalProofRuns > 0 ? `${(avgStage3Ms / 1000).toFixed(1)}s` : '—', sub: `${totalProofRuns} runs`, color: avgStage3Ms > 5000 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Stage 3 Block Rate', value: totalProofRuns > 0 ? `${stage3FailRate}%` : '—', sub: `${failedProofRuns} blocked`, color: stage3FailRate > 30 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Avg Stage 4 Duration', value: totalDesignRuns > 0 ? `${(avgStage4Ms / 1000).toFixed(1)}s` : '—', sub: `${totalDesignRuns} runs`, color: avgStage4Ms > 7000 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Stage 4 Block Rate', value: totalDesignRuns > 0 ? `${stage4FailRate}%` : '—', sub: `${failedDesignRuns} blocked`, color: stage4FailRate > 30 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
                    ].map(k => (
                      <div key={k.label} className="text-center">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{k.label}</p>
                        <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 pb-4 border-t dark:border-slate-700 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Snapshot Reuse Rate</span>
                      <span className={`text-sm font-black ${snapshotReuse >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{uniqueLessonsRun > 0 ? `${snapshotReuse}%` : '—'}</span>
                    </div>
                    <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(snapshotReuse, 100)}%` }} />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">{qaSnapshots.length} snapshot(s) across {uniqueLessonsRun} lesson(s). Target: 100% — every lesson should have exactly one snapshot.</p>
                  </div>
                </div>

                {/* Recent runs table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recent Runs (last 200)</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="border-b dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-400">Stage</th>
                          <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-400">Core</th>
                          <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-400">Module</th>
                          <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-400">Total</th>
                          <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-400">Trigger</th>
                          <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-400">Status</th>
                          <th className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-400">When</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-700">
                        {qaRuns.slice(0, 50).map(r => (
                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                            <td className="px-4 py-2.5 font-mono font-bold dark:text-slate-200">Stage {r.stage}</td>
                            <td className="px-4 py-2.5 dark:text-slate-300">{r.core_score}/30</td>
                            <td className="px-4 py-2.5 dark:text-slate-300">{r.module_score}/20</td>
                            <td className="px-4 py-2.5 font-bold dark:text-slate-200">{r.total_score}/50</td>
                            <td className="px-4 py-2.5">
                              {r.serious_trigger_flag
                                ? <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Serious</span>
                                : <span className="text-[9px] text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${r.status === 'pass' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{r.status}</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 font-mono">{r.timestamp?.toDate?.()?.toLocaleDateString?.() ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* ============================================================ */}
                {/* PHASE 4 — CALIBRATION & INTELLIGENCE LAYER                  */}
                {/* All computations from existing state — no new collections.  */}
                {/* ============================================================ */}

                {/* 1. Reviewer Calibration */}
                {(() => {
                  const byReviewer: Record<string, { scores: number[]; cores: number[]; modules: number[]; serious: number; total: number }> = {};
                  qaRuns.forEach(r => {
                    const id = r.reviewer_id ?? 'unknown';
                    if (!byReviewer[id]) byReviewer[id] = { scores: [], cores: [], modules: [], serious: 0, total: 0 };
                    byReviewer[id].scores.push(r.total_score ?? 0);
                    byReviewer[id].cores.push(r.core_score ?? 0);
                    byReviewer[id].modules.push(r.module_score ?? 0);
                    if (r.serious_trigger_flag) byReviewer[id].serious++;
                    byReviewer[id].total++;
                  });
                  const reviewers = Object.entries(byReviewer).map(([id, d]) => {
                    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
                    const mean = avg(d.scores);
                    const variance = d.scores.length > 1
                      ? Math.round(d.scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / d.scores.length)
                      : 0;
                    return { id, runs: d.total, avgTotal: mean, avgCore: avg(d.cores), avgModule: avg(d.modules), seriousRate: d.total > 0 ? Math.round((d.serious / d.total) * 100) : 0, variance };
                  }).sort((a, b) => b.runs - a.runs);
                  if (reviewers.length === 0) return null;
                  return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                      <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Reviewer Calibration</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="border-b dark:border-slate-700">
                            <tr>
                              {['Reviewer', 'Runs', 'Avg Total', 'Avg Core', 'Avg Module', 'Score Variance', 'Serious Rate'].map(h => (
                                <th key={h} className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-700">
                            {reviewers.map(r => (
                              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                <td className="px-4 py-2 font-mono text-[10px] dark:text-slate-300 truncate max-w-[120px]">{r.id}</td>
                                <td className="px-4 py-2 dark:text-slate-300">{r.runs}</td>
                                <td className="px-4 py-2 font-bold dark:text-slate-200">{r.avgTotal}/50</td>
                                <td className="px-4 py-2 dark:text-slate-300">{r.avgCore}/30</td>
                                <td className="px-4 py-2 dark:text-slate-300">{r.avgModule}/20</td>
                                <td className="px-4 py-2">
                                  <span className={`font-mono ${r.variance > 50 ? 'text-amber-600 dark:text-amber-400 font-black' : 'dark:text-slate-300'}`}>{r.variance}</span>
                                  {r.variance > 50 && <span className="ml-1 text-[8px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded font-black uppercase">Drift</span>}
                                </td>
                                <td className="px-4 py-2">
                                  <span className={r.seriousRate > 50 ? 'text-red-600 dark:text-red-400 font-black' : 'dark:text-slate-300'}>{r.seriousRate}%</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Writer Performance Analytics */}
                {(() => {
                  const byWriter: Record<string, { scores: number[]; revisions: number; lessons: Set<string>; proofDensities: number[]; stage4Blocks: number; stage4Total: number }> = {};
                  qaRuns.forEach(r => {
                    const wid = r.writer_id ?? r.lesson_id ?? 'unknown';
                    if (!byWriter[wid]) byWriter[wid] = { scores: [], revisions: 0, lessons: new Set(), proofDensities: [], stage4Blocks: 0, stage4Total: 0 };
                    byWriter[wid].scores.push(r.total_score ?? 0);
                    if (r.status === 'revision-required') byWriter[wid].revisions++;
                    if (r.lesson_id) byWriter[wid].lessons.add(r.lesson_id);
                  });
                  qaProofreadingRuns.forEach(r => {
                    const wid = r.lesson_id ?? 'unknown';
                    if (!byWriter[wid]) byWriter[wid] = { scores: [], revisions: 0, lessons: new Set(), proofDensities: [], stage4Blocks: 0, stage4Total: 0 };
                    if (r.proofreading_density != null) byWriter[wid].proofDensities.push(r.proofreading_density);
                  });
                  qaDesignRuns.forEach(r => {
                    const wid = r.lesson_id ?? 'unknown';
                    if (!byWriter[wid]) byWriter[wid] = { scores: [], revisions: 0, lessons: new Set(), proofDensities: [], stage4Blocks: 0, stage4Total: 0 };
                    byWriter[wid].stage4Total++;
                    if (r.status === 'blocked') byWriter[wid].stage4Blocks++;
                  });
                  const writers = Object.entries(byWriter).map(([id, d]) => {
                    const avgScore = d.scores.length > 0 ? Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length) : 0;
                    const avgDensity = d.proofDensities.length > 0 ? (d.proofDensities.reduce((s, v) => s + v, 0) / d.proofDensities.length).toFixed(2) : '—';
                    const s4BlockRate = d.stage4Total > 0 ? Math.round((d.stage4Blocks / d.stage4Total) * 100) : 0;
                    const revisionRate = d.scores.length > 0 ? Math.round((d.revisions / d.scores.length) * 100) : 0;
                    return { id, lessons: d.lessons.size, avgScore, avgDensity, s4BlockRate, revisionRate, totalRuns: d.scores.length };
                  }).filter(w => w.totalRuns > 0).sort((a, b) => b.totalRuns - a.totalRuns).slice(0, 20);
                  if (writers.length === 0) return null;
                  return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                      <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Writer Performance (top 20 by run volume · no ranking)</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="border-b dark:border-slate-700">
                            <tr>
                              {['Lesson / Writer ID', 'Runs', 'Lessons', 'Avg Score', 'Proof Density', 'S4 Block Rate', 'Revision Rate'].map(h => (
                                <th key={h} className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-700">
                            {writers.map(w => (
                              <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                <td className="px-4 py-2 font-mono text-[10px] dark:text-slate-300 truncate max-w-[140px]">{w.id}</td>
                                <td className="px-4 py-2 dark:text-slate-300">{w.totalRuns}</td>
                                <td className="px-4 py-2 dark:text-slate-300">{w.lessons}</td>
                                <td className="px-4 py-2 font-bold dark:text-slate-200">{w.avgScore}/50</td>
                                <td className="px-4 py-2">
                                  <span className={typeof w.avgDensity === 'string' ? 'text-slate-400' : Number(w.avgDensity) > 3 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'dark:text-slate-300'}>{w.avgDensity}</span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className={w.s4BlockRate > 50 ? 'text-red-600 dark:text-red-400 font-bold' : 'dark:text-slate-300'}>{w.s4BlockRate > 0 ? `${w.s4BlockRate}%` : '—'}</span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className={w.revisionRate > 50 ? 'text-red-600 dark:text-red-400 font-bold' : 'dark:text-slate-300'}>{w.revisionRate}%</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Trigger Pattern Intelligence */}
                {(() => {
                  const now = Date.now();
                  const MS_30 = 30 * 24 * 60 * 60 * 1000;
                  const MS_60 = 60 * 24 * 60 * 60 * 1000;
                  const MS_90 = 90 * 24 * 60 * 60 * 1000;
                  const countTriggers = (withinMs: number) => {
                    const freq: Record<string, number> = {};
                    qaRuns.forEach(r => {
                      const ts = r.timestamp?.toDate?.()?.getTime?.() ?? 0;
                      if (now - ts > withinMs) return;
                      (r.triggers ?? []).forEach((t: any) => {
                        if (t.blocks_progression) freq[t.trigger_type] = (freq[t.trigger_type] ?? 0) + 1;
                      });
                    });
                    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
                  };
                  const byModule: Record<string, Record<string, number>> = {};
                  qaRuns.forEach(r => {
                    const mod = r.module_id ?? 'unknown';
                    if (!byModule[mod]) byModule[mod] = {};
                    (r.triggers ?? []).forEach((t: any) => {
                      if (t.blocks_progression) byModule[mod][t.trigger_type] = (byModule[mod][t.trigger_type] ?? 0) + 1;
                    });
                  });
                  const t30 = countTriggers(MS_30);
                  const t60 = countTriggers(MS_60);
                  const t90 = countTriggers(MS_90);
                  const triggerData = triggerWindow === '30' ? t30 : triggerWindow === '60' ? t60 : t90;
                  const maxCount = triggerData[0]?.[1] ?? 1;
                  const moduleEntries = Object.entries(byModule).map(([mod, freq]) => {
                    const modName = qaModules.find(m => m.id === mod)?.name ?? mod;
                    const topTrigger = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
                    return { mod, modName, topTrigger: topTrigger?.[0] ?? '—', topCount: topTrigger?.[1] ?? 0, total: Object.values(freq).reduce((s, v) => s + v, 0) };
                  }).sort((a, b) => b.total - a.total);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Serious Trigger Frequency</h4>
                          <div className="flex gap-1">
                            {(['30', '60', '90'] as const).map(w => (
                              <button key={w} onClick={() => setTriggerWindow(w)} className={`text-[9px] font-black px-2 py-0.5 rounded transition-colors ${triggerWindow === w ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>{w}d</button>
                            ))}
                          </div>
                        </div>
                        {triggerData.length === 0 ? (
                          <p className="px-5 py-6 text-xs text-slate-400 text-center">No serious triggers in this window.</p>
                        ) : (
                          <div className="p-4 space-y-2">
                            {triggerData.map(([type, count]) => (
                              <div key={type} className="flex items-center gap-3">
                                <span className="text-[10px] font-mono dark:text-slate-300 w-40 truncate shrink-0">{type}</span>
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-1.5 rounded-full bg-red-500 transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                                </div>
                                <span className="text-[10px] font-black text-red-600 dark:text-red-400 w-6 text-right">{count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Trigger Frequency by Module</h4>
                        </div>
                        {moduleEntries.length === 0 ? (
                          <p className="px-5 py-6 text-xs text-slate-400 text-center">No module trigger data yet.</p>
                        ) : (
                          <div className="p-4 space-y-2">
                            {moduleEntries.slice(0, 8).map(m => (
                              <div key={m.mod} className="flex items-center justify-between">
                                <span className="text-[10px] dark:text-slate-300 truncate max-w-[160px]">{m.modName}</span>
                                <span className="flex items-center gap-2 shrink-0">
                                  <span className="text-[9px] font-mono text-slate-400 truncate max-w-[80px]">{m.topTrigger}</span>
                                  <span className="text-[10px] font-black text-red-600 dark:text-red-400">{m.total}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Time-to-Clear Metrics */}
                {(() => {
                  const toMs = (ts: any): number | null => {
                    try { return ts?.toDate?.()?.getTime?.() ?? null; } catch { return null; }
                  };
                  type StagePair = { s1s?: number | null; s1c?: number | null; s2s?: number | null; s2c?: number | null; s3c?: number | null; s4c?: number | null; s5c?: number | null };
                  const lessonTimes: Record<string, StagePair> = {};
                  // We derive these from the lesson collection via qaRuns timestamps as a proxy
                  // (Full lesson timestamps require a separate qa_lessons listener — using run records here)
                  const runsByLesson: Record<string, any[]> = {};
                  qaRuns.forEach(r => {
                    if (!runsByLesson[r.lesson_id]) runsByLesson[r.lesson_id] = [];
                    runsByLesson[r.lesson_id].push(r);
                  });
                  const deltas1to2: number[] = [];
                  const deltasTotalClear: number[] = [];
                  const stageBottleneck: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 };
                  Object.values(runsByLesson).forEach(runs => {
                    const s1Runs = runs.filter(r => r.stage === 1).sort((a, b) => (toMs(a.timestamp) ?? 0) - (toMs(b.timestamp) ?? 0));
                    const s2Runs = runs.filter(r => r.stage === 2).sort((a, b) => (toMs(a.timestamp) ?? 0) - (toMs(b.timestamp) ?? 0));
                    const s1Pass = s1Runs.find(r => r.status === 'pass');
                    const s2Pass = s2Runs.find(r => r.status === 'pass');
                    const s1First = s1Runs[0];
                    if (s1First && s1Pass) {
                      const revCount = s1Runs.indexOf(s1Pass);
                      if (revCount > 0) stageBottleneck['1']++;
                    }
                    if (s1Pass && s2Pass) {
                      const d = (toMs(s2Pass.timestamp) ?? 0) - (toMs(s1Pass.timestamp) ?? 0);
                      if (d > 0) deltas1to2.push(d);
                    }
                    const s2Revs = s2Runs.filter(r => r.status === 'revision-required').length;
                    if (s2Revs > 0) stageBottleneck['2'] += s2Revs;
                  });
                  qaProofreadingRuns.forEach(r => { if (r.status === 'blocked') stageBottleneck['3']++; });
                  qaDesignRuns.forEach(r => { if (r.status === 'blocked') stageBottleneck['4']++; });
                  const avgMs = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;
                  const fmtDuration = (ms: number | null) => {
                    if (ms === null) return '—';
                    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
                    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
                    return `${(ms / 3600000).toFixed(1)}h`;
                  };
                  const avg12 = avgMs(deltas1to2);
                  const bottleneckStage = Object.entries(stageBottleneck).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                      <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Time-to-Clear Metrics</h4>
                      </div>
                      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Avg Stage 1→2 Gap', value: fmtDuration(avg12), sub: `${deltas1to2.length} lesson pairs` },
                          { label: 'S1 Revision Loops', value: stageBottleneck['1'], sub: 'lessons with >1 S1 attempt' },
                          { label: 'S2 Revision Loops', value: stageBottleneck['2'], sub: 'total S2 revisions' },
                          { label: 'Bottleneck Stage', value: bottleneckStage?.[1] > 0 ? `Stage ${bottleneckStage[0]}` : '—', sub: bottleneckStage?.[1] > 0 ? `${bottleneckStage[1]} blocks/revisions` : 'No data yet' },
                        ].map(k => (
                          <div key={k.label} className="text-center">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{k.label}</p>
                            <p className="text-2xl font-black text-slate-700 dark:text-slate-200">{k.value}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 5. Module Effectiveness */}
                {(() => {
                  const byModule: Record<string, { moduleName: string; scores: number[]; serious: number; revisions: number; total: number; completions: number }> = {};
                  qaRuns.forEach(r => {
                    const mid = r.module_id ?? 'unknown';
                    const modName = qaModules.find((m: any) => m.id === mid)?.name ?? mid;
                    if (!byModule[mid]) byModule[mid] = { moduleName: modName, scores: [], serious: 0, revisions: 0, total: 0, completions: 0 };
                    byModule[mid].scores.push(r.module_score ?? 0);
                    if (r.serious_trigger_flag) byModule[mid].serious++;
                    if (r.status === 'revision-required') byModule[mid].revisions++;
                    if (r.status === 'pass') byModule[mid].completions++;
                    byModule[mid].total++;
                  });
                  const modules = Object.entries(byModule).map(([id, d]) => ({
                    id,
                    name: d.moduleName,
                    avgScore: d.scores.length > 0 ? Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length) : 0,
                    seriousRate: d.total > 0 ? Math.round((d.serious / d.total) * 100) : 0,
                    revisionRate: d.total > 0 ? Math.round((d.revisions / d.total) * 100) : 0,
                    completionRate: d.total > 0 ? Math.round((d.completions / d.total) * 100) : 0,
                    total: d.total,
                  })).sort((a, b) => b.total - a.total);
                  if (modules.length === 0) return null;
                  return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                      <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Module Effectiveness</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="border-b dark:border-slate-700">
                            <tr>
                              {['Module', 'Runs', 'Avg Module Score', 'Serious Rate', 'Revision Rate', 'Completion Rate'].map(h => (
                                <th key={h} className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-700">
                            {modules.map(m => (
                              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                <td className="px-4 py-2 font-medium dark:text-slate-200 truncate max-w-[160px]">{m.name}</td>
                                <td className="px-4 py-2 dark:text-slate-300">{m.total}</td>
                                <td className="px-4 py-2">
                                  <span className={m.avgScore < 12 ? 'text-red-600 dark:text-red-400 font-bold' : 'dark:text-slate-300'}>{m.avgScore}/20</span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className={m.seriousRate > 40 ? 'text-red-600 dark:text-red-400 font-bold' : 'dark:text-slate-300'}>{m.seriousRate}%</span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className={m.revisionRate > 50 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'dark:text-slate-300'}>{m.revisionRate}%</span>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${m.completionRate}%` }} />
                                    </div>
                                    <span className={m.completionRate < 50 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>{m.completionRate}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* 6. Governance Drift Monitor */}
                {(() => {
                  const OVERRIDE_RATE_THRESHOLD = 15;
                  const SERIOUS_DROP_THRESHOLD = 5;
                  const DENSITY_SPIKE_THRESHOLD = 5;
                  const recentRuns = qaRuns.filter(r => {
                    const ts = r.timestamp?.toDate?.()?.getTime?.() ?? 0;
                    return Date.now() - ts < 30 * 24 * 60 * 60 * 1000;
                  });
                  const olderRuns = qaRuns.filter(r => {
                    const ts = r.timestamp?.toDate?.()?.getTime?.() ?? 0;
                    const age = Date.now() - ts;
                    return age >= 30 * 24 * 60 * 60 * 1000 && age < 60 * 24 * 60 * 60 * 1000;
                  });
                  const seriousRateRecent = recentRuns.length > 0 ? Math.round((recentRuns.filter(r => r.serious_trigger_flag).length / recentRuns.length) * 100) : null;
                  const seriousRateOlder = olderRuns.length > 0 ? Math.round((olderRuns.filter(r => r.serious_trigger_flag).length / olderRuns.length) * 100) : null;
                  const seriousDrop = seriousRateRecent !== null && seriousRateOlder !== null && seriousRateOlder > 0
                    ? seriousRateOlder - seriousRateRecent
                    : null;
                  const recentDensities = qaProofreadingRuns
                    .filter(r => { const ts = r.timestamp?.toDate?.()?.getTime?.() ?? 0; return Date.now() - ts < 30 * 24 * 60 * 60 * 1000; })
                    .map(r => r.proofreading_density ?? 0);
                  const avgRecentDensity = recentDensities.length > 0 ? recentDensities.reduce((s, v) => s + v, 0) / recentDensities.length : 0;
                  const alerts: { level: 'warn' | 'info'; label: string; detail: string }[] = [];
                  if (seriousDrop !== null && seriousDrop > SERIOUS_DROP_THRESHOLD) {
                    alerts.push({ level: 'warn', label: 'Serious Trigger Drop', detail: `Rate fell ${seriousDrop}pp in last 30 days (${seriousRateOlder}% → ${seriousRateRecent}%). May indicate prompt weakness or under-flagging.` });
                  }
                  if (avgRecentDensity > DENSITY_SPIKE_THRESHOLD) {
                    alerts.push({ level: 'warn', label: 'Proofreading Density Spike', detail: `Avg correction density is ${avgRecentDensity.toFixed(2)} per 100 words (threshold: ${DENSITY_SPIKE_THRESHOLD}). Review writer training.` });
                  }
                  if (alerts.length === 0) {
                    alerts.push({ level: 'info', label: 'No drift detected', detail: 'All governance indicators within normal range.' });
                  }
                  return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                      <div className="px-5 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Governance Drift Monitor · Visual Only</h4>
                      </div>
                      <div className="p-4 space-y-2">
                        {alerts.map((a, i) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${a.level === 'warn' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700'}`}>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shrink-0 mt-0.5 ${a.level === 'warn' ? 'bg-amber-500 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300'}`}>{a.level === 'warn' ? 'ALERT' : 'OK'}</span>
                            <div>
                              <p className="text-xs font-bold dark:text-slate-200">{a.label}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{a.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-5 pb-3 pt-1">
                        <p className="text-[9px] text-slate-400">No auto-actions. Visual indicators only. Thresholds: override &gt;{OVERRIDE_RATE_THRESHOLD}%, serious drop &gt;{SERIOUS_DROP_THRESHOLD}pp, density &gt;{DENSITY_SPIKE_THRESHOLD}/100 words.</p>
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
};