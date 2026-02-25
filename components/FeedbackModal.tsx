
import React, { useState, useEffect } from 'react';
import { X, Lightbulb, Wrench, Send, History, Trash2, CheckCircle2, Loader2, Pencil, Link, Check } from 'lucide-react';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EntryType = 'idea' | 'fix';

interface IdeaItem {
  id: string;
  text: string;
  timestamp: any;
  updatedAt?: any;
  status?: string;
  type?: EntryType;
  userId: string;
  linkedTaskUrl?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [ideaText, setIdeaText] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('idea');
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editLinkedUrl, setEditLinkedUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
        // Query only the current user's ideas for the "My History" tab
        const q = query(
          collection(db, 'tool_ideas'),
          where('userId', '==', user.uid)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const sorted = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as IdeaItem))
            .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
          setIdeas(sorted);
        }, (error) => {
          console.error("Snapshot error:", error);
        });
        return unsubscribe;
    }
  }, [isOpen, user]);

  const handleSave = async () => {
    if (!ideaText.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Logic aligns with rules: userId is used for 'allow create' and 'allow read'
      await addDoc(collection(db, 'tool_ideas'), {
        text: ideaText.trim(),
        type: entryType,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'Anonymous User',
        timestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'new',
        linkedTaskUrl: null,
      });
      
      setIdeaText('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save idea:", error);
      alert("Error saving idea. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this entry from your history?")) {
      try {
        await deleteDoc(doc(db, 'tool_ideas', id));
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }
  };

  const startEdit = (idea: IdeaItem) => {
    setEditingId(idea.id);
    setEditText(idea.text);
    setEditLinkedUrl(idea.linkedTaskUrl ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditLinkedUrl('');
  };

  const saveEdit = async (idea: IdeaItem) => {
    if (!editText.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateDoc(doc(db, 'tool_ideas', idea.id), {
        text: editText.trim(),
        linkedTaskUrl: editLinkedUrl.trim() || null,
        updatedAt: serverTimestamp(),
      });
      cancelEdit();
    } catch (e) {
      console.error('Edit failed:', e);
      alert('Failed to save edit.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const statusBadgeClass = (status?: string) => {
    switch (status) {
      case 'reviewed':  return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
      case 'actioned':  return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
      default:          return 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] transition-colors border border-slate-200 dark:border-slate-700">
          
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Ideas & Fixes</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Suggest features or report issues</p>
                </div>
             </div>
             <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1">
               <X className="w-6 h-6" />
             </button>
          </div>

          <div className="flex border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'form' 
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-500/5' 
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Submit
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'history' 
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-500/5' 
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              My History
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
             {activeTab === 'form' ? (
               <div className="space-y-4">
                 {/* Type selector */}
                 <div className="flex gap-3">
                   {(['idea', 'fix'] as EntryType[]).map(t => (
                     <button
                       key={t}
                       onClick={() => setEntryType(t)}
                       className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-2 transition-all ${
                         entryType === t
                           ? t === 'idea'
                             ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                             : 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                           : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                       }`}
                     >
                       {t === 'idea' ? <Lightbulb className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                       {t === 'idea' ? 'New Idea' : 'Bug / Fix'}
                     </button>
                   ))}
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                     {entryType === 'idea' ? 'What should we build or improve?' : 'What needs fixing?'}
                   </label>
                   <textarea
                     value={ideaText}
                     onChange={(e) => setIdeaText(e.target.value)}
                     disabled={isSubmitting}
                     placeholder={entryType === 'idea' ? 'e.g., A quiz generator that takes a vocabulary list...' : 'e.g., The export button crashes when the list is empty...'}
                     className="w-full h-32 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-orange-500 focus:ring-orange-500 dark:focus:border-orange-400 p-3 resize-none transition-colors"
                   />
                 </div>
                 
                 {showSuccess && (
                   <div className="p-3 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg flex items-center gap-2 text-sm animate-fade-in border border-teal-100 dark:border-teal-800">
                     <CheckCircle2 className="w-4 h-4"/>
                     Thanks! Your idea has been saved securely.
                   </div>
                 )}

                 <button
                   onClick={handleSave}
                   disabled={!ideaText.trim() || isSubmitting}
                   className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                 >
                   {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   {entryType === 'idea' ? 'Submit Idea' : 'Report Fix'}
                 </button>
               </div>
             ) : (
               <div className="space-y-4">
                 {ideas.length === 0 ? (
                   <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                     <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                     <p>No ideas submitted yet.</p>
                   </div>
                 ) : (
                   ideas.map((idea) => {
                    const isEditing = editingId === idea.id;
                    const isOwner = user?.uid === idea.userId;
                    return (
                    <div key={idea.id} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700 group transition-colors">
                      {/* Header row */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                            idea.type === 'fix'
                              ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                              : 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                          }`}>
                            {idea.type === 'fix' ? 'Fix' : 'Idea'}
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${statusBadgeClass(idea.status)}`}>
                            {idea.status ?? 'new'}
                          </span>
                        </div>
                        {isOwner && !isEditing && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(idea)} className="text-slate-400 hover:text-indigo-500 transition-colors p-1" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(idea.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Body: view or edit */}
                      {isEditing ? (
                        <div className="space-y-2 mt-2">
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            className="w-full h-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm p-2 resize-none focus:outline-none focus:border-indigo-500"
                          />
                          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5">
                            <Link className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              value={editLinkedUrl}
                              onChange={e => setEditLinkedUrl(e.target.value)}
                              placeholder="Linked task URL (optional)"
                              className="flex-1 text-xs bg-transparent text-slate-700 dark:text-slate-300 outline-none placeholder:text-slate-400"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                            <button onClick={() => saveEdit(idea)} disabled={isSavingEdit || !editText.trim()} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50">
                              {isSavingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{idea.text}</p>
                          {idea.linkedTaskUrl && (
                            <a href={idea.linkedTaskUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-500 hover:text-indigo-600 font-mono truncate">
                              <Link className="w-3 h-3 shrink-0" />{idea.linkedTaskUrl}
                            </a>
                          )}
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-2">
                            {idea.timestamp?.toDate().toLocaleString() || 'Syncing...'}
                            {idea.updatedAt && idea.updatedAt?.seconds !== idea.timestamp?.seconds && (
                              <span className="ml-2 text-slate-300 dark:text-slate-600">(edited)</span>
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  );
                  })
                 )}
               </div>
             )}
          </div>
       </div>
    </div>
  );
};
