
import React, { useState, useEffect } from 'react';
import { 
  StickyNote, Plus, Search, LayoutGrid, List, ExternalLink, 
  Filter, Loader2, X, Tag, Calendar, Share2, Lock, Edit3, Trash2, 
  Save, CheckCircle2, User
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { InternalNote } from '../types';
import { useAuth } from '../context/AuthContext';

export const InternalNotes: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'All' | 'My Notes' | 'Shared'>('All');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<InternalNote | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    isShared: false
  });

  useEffect(() => {
    if (!user) return;

    // Use a simpler query and filter on the frontend for now to avoid index creation requirements if tags/shared logic gets complex
    const notesCollection = collection(db, 'notes');
    const q = query(notesCollection, orderBy('updatedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as InternalNote));
      setNotes(fetchedNotes);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const allTags = ['All', ...Array.from(new Set(notes.flatMap(n => n.tags || []).filter(Boolean)))];

  const filteredNotes = notes.filter(note => {
    const title = note.title || '';
    const content = note.content || '';
    
    // Visibility logic
    const isOwner = note.createdBy === user?.uid;
    const isVisible = note.isShared || isOwner || isAdmin;
    if (!isVisible) return false;

    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = activeTag === 'All' || (note.tags && note.tags.includes(activeTag));
    
    const matchesTab = 
      activeTab === 'All' || 
      (activeTab === 'My Notes' && isOwner) || 
      (activeTab === 'Shared' && note.isShared);

    return matchesSearch && matchesTag && matchesTab;
  });

  const handleOpenAdd = () => {
    setEditingNote(null);
    setFormData({ title: '', content: '', tags: '', isShared: false });
    setShowForm(true);
  };

  const handleOpenEdit = (note: InternalNote) => {
    if (note.createdBy !== user?.uid && !isAdmin) return;
    setEditingNote(note);
    setFormData({ 
      title: note.title, 
      content: note.content, 
      tags: (note.tags || []).join(', '), 
      isShared: note.isShared 
    });
    setShowForm(true);
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      await deleteDoc(doc(db, 'notes', noteId));
    } catch (e) {
      alert("Error deleting note.");
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert("Title is required.");
      return;
    }

    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
    const data = {
      title: formData.title.trim(),
      content: formData.content.trim(),
      tags: tagsArray,
      isShared: formData.isShared,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingNote) {
        await updateDoc(doc(db, 'notes', editingNote.id!), data);
      } else {
        await addDoc(collection(db, 'notes'), {
          ...data,
          createdAt: serverTimestamp(),
          createdBy: user?.uid,
          userName: user?.displayName || 'Unknown User'
        });
      }
      setShowForm(false);
    } catch (e) {
      alert("Error saving note.");
    }
  };

  // Added React.FC type to allow 'key' prop when rendering in a list and avoid TypeScript error
  const NoteCard: React.FC<{ note: InternalNote }> = ({ note }) => {
    const isOwner = note.createdBy === user?.uid;
    const date = note.updatedAt?.toDate() || note.createdAt?.toDate() || new Date();
    
    return (
      <div className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between shadow-sm relative">
        <div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-wrap gap-1">
              {(note.tags || []).slice(0, 3).map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold rounded">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {note.isShared ? (
                <Share2 className="w-3.5 h-3.5 text-orange-500" title="Shared with team" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-400" title="Private" />
              )}
            </div>
          </div>
          
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{note.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-4 whitespace-pre-wrap">{note.content}</p>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <Calendar className="w-3 h-3" />
            {date.toLocaleDateString()}
            <span className="mx-1 opacity-30">|</span>
            <span className="truncate max-w-[80px] font-medium">{note.userName}</span>
          </div>
          
          {(isOwner || isAdmin) && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleOpenEdit(note)} className="p-1.5 text-slate-400 hover:text-orange-500 transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(note.id!)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Added React.FC type to allow 'key' prop when rendering in a list and avoid TypeScript error
  const NoteListItem: React.FC<{ note: InternalNote }> = ({ note }) => {
    const isOwner = note.createdBy === user?.uid;
    const date = note.updatedAt?.toDate() || note.createdAt?.toDate() || new Date();

    return (
      <div className="flex items-center gap-4 p-5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group">
        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 flex-shrink-0">
          <StickyNote className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-0.5">
            <h3 className="font-bold text-slate-900 dark:text-white truncate">{note.title}</h3>
            {note.isShared ? (
              <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[8px] font-black uppercase rounded">Shared</span>
            ) : (
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[8px] font-black uppercase rounded">Private</span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{note.content}</p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[10px] text-slate-400 font-medium whitespace-nowrap">
           <User className="w-3 h-3" /> {note.userName}
        </div>
        <div className="flex items-center gap-3">
          {(isOwner || isAdmin) && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleOpenEdit(note)} className="p-2 text-slate-400 hover:text-orange-500 transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(note.id!)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <span className="text-[10px] text-slate-400 font-mono">{date.toLocaleDateString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <StickyNote className="w-7 h-7 text-orange-500" />
            Internal Notes
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage personal and team-wide educational notes.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-500' : 'text-slate-400'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-500' : 'text-slate-400'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create Note
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles or content..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['All', 'My Notes', 'Shared'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === tab 
                  ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 self-center mx-2" />
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeTag === tag 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
           <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
           <p className="text-slate-500 font-medium">Loading notes...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
           <StickyNote className="w-12 h-12 text-slate-300 mx-auto mb-4" />
           <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">No notes found</h3>
           <p className="text-slate-500 mt-2">Create your first note or adjust your filters.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map(note => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y dark:divide-slate-700">
          {filteredNotes.map(note => (
            <NoteListItem key={note.id} note={note} />
          ))}
        </div>
      )}

      {/* Note Edit/Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden border dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  {editingNote ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold dark:text-white">{editingNote ? 'Edit Note' : 'Create New Note'}</h3>
                  <p className="text-xs text-slate-500">Internal educational documentation</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Title</label>
                <input 
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="Note title..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white font-bold transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Content</label>
                <textarea 
                  value={formData.content}
                  onChange={e => setFormData({...formData, content: e.target.value})}
                  placeholder="Type your notes here..."
                  rows={8}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Tags (Comma separated)</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={formData.tags}
                      onChange={e => setFormData({...formData, tags: e.target.value})}
                      placeholder="curriculum, vocabulary, tips..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white transition-all"
                    />
                  </div>
                    <input 
                      type="checkbox"
                      checked={formData.isShared}
                      onChange={e => setFormData({...formData, isShared: e.target.checked})}
                      className="hidden"
                    />
                    <div className={`w-10 h-6 rounded-full relative transition-colors ${formData.isShared ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                      <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-all ${formData.isShared ? 'left-5' : 'left-1'}`} />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button 
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                {editingNote ? 'Save Changes' : 'Create Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
