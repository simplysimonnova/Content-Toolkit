import React, { useState, useEffect } from 'react';
import { 
  X, LayoutDashboard, Shield, Terminal, History, Trash2, Plus, 
  Loader2, UserPlus, Link2, Lightbulb, Save, AlertCircle, 
  Menu, ChevronUp, ChevronDown, ListOrdered, Edit3, Settings2,
  LayoutGrid, List, Check, RotateCcw, Presentation, UserCog, UserMinus,
  RefreshCw, LifeBuoy, GripVertical, Hash, Zap, SearchCheck, Wand2, Palette,
  Volume2, PenLine, ClipboardCheck, ShieldCheck, CreditCard, Tag, ListFilter,
  ShieldBan, Map, Search
} from 'lucide-react';
import { collection, query, doc, onSnapshot, orderBy, limit, deleteDoc, setDoc, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import { db } from './services/firebase';

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
  const [activeTab, setActiveTab] = useState<'usage' | 'users' | 'navigation' | 'links' | 'directus' | 'rules'>('usage');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Shared Data ---
  const [usage, setUsage] = useState<any[]>([]);
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

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const unsubscribes: (() => void)[] = [];

    unsubscribes.push(onSnapshot(query(collection(db, 'usage'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setUsage(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

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

    return () => unsubscribes.forEach(unsub => unsub());
  }, [isOpen]);

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
    
    const initialConfig: NavGroup[] = [
      {
        id: 'lesson_tools',
        title: 'Lesson Tools',
        items: [
          { id: 'l1', label: 'Lesson Descriptions', icon: 'FileText', page: 'lesson-descriptions' },
          { id: 'l2', label: 'TAF Generator', icon: 'TableProperties', page: 'taf-generator' }
        ]
      },
      {
        id: 'tech_tools',
        title: 'Tech Tools',
        items: [
          { id: 't1', label: 'Class ID Finder', icon: 'Hash', page: 'class-id-finder' }
        ]
      },
      {
        id: 'curriculum_planning',
        title: 'Curriculum & Planning',
        items: [
          { id: 'cp1', label: 'S&S Compactor', icon: 'Zap', page: 'ss-compactor' },
          { id: 'cp2', label: 'Curriculum Gap Spotter', icon: 'SearchCheck', page: 'gap-spotter' }
        ]
      },
      {
        id: 'lesson_creation',
        title: 'Lesson Creation',
        items: [
          { id: 'lc1', label: 'Lesson Plan Generator', icon: 'Wand2', page: 'plan-generator' },
          { id: 'lc2', label: 'Slide-creator Studio', icon: 'Presentation', page: 'slide-creator' },
          { id: 'lc3', label: 'VR Validator', icon: 'Map', page: 'vr-validator' }
        ]
      },
      {
        id: 'llm_tools',
        title: 'LLM Tools',
        items: [
          { id: 'w1', label: 'Word Cleaner', icon: 'ListFilter', page: 'word-cleaner' },
          { id: 'w2', label: 'Topic Assigner', icon: 'Tag', page: 'topic-assigner' },
          { id: 'w3', label: 'List Merger', icon: 'ListOrdered', page: 'list-merger' },
          { id: 'w4', label: 'LLM Content Checker', icon: 'Search', page: 'llm-content-checker' },
          { id: 'w5', label: 'Deduplicator', icon: 'ShieldBan', page: 'deduplicator' }
        ]
      },
      {
        id: 'proofing_tools',
        title: 'Proofing Tools',
        items: [
          { id: 'p1', label: 'General Proofing Bot', icon: 'ClipboardCheck', page: 'proofing-bot' },
          { id: 'p2', label: 'Lesson Proofing Bot', icon: 'ShieldCheck', page: 'lesson-proofing-bot' }
        ]
      },
      {
        id: 'media_assets',
        title: 'Media & Assets',
        items: [
          { id: 'm1', label: 'Image Extractor', icon: 'Link2', page: 'image-extractor' },
          { id: 'm2', label: 'Prompt Writer', icon: 'PenLine', page: 'prompt-writer' },
          { id: 'm3', label: 'Prompt Redesigner', icon: 'Wand2', page: 'prompt-rewriter' },
          { id: 'm4', label: 'Sound Generator', icon: 'Volume2', page: 'sound-generator' },
          { id: 'm5', label: 'Nano Banana Studio', icon: 'Palette', page: 'nano-banana' },
          { id: 'm6', label: 'Image Renamer', icon: 'Search', page: 'image-renamer' }
        ]
      }
    ];
    await saveNavigation(initialConfig);
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
    const updated