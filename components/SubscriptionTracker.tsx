
import React, { useState, useEffect, useRef } from 'react';
import { 
  CreditCard, Plus, FileUp, FileDown, PieChart, Search, 
  Lock, Edit3, Trash2, ChevronDown, List, LayoutGrid, X,
  AlertCircle, CheckCircle2, Bot, Calendar, Save, Loader2
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, doc, addDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Subscription } from '../types';
import { useAuth } from '../context/AuthContext';
import { parseSubscriptionsFromPDF } from '../services/geminiService';

export const SubscriptionTracker: React.FC = () => {
  const { isAdmin } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // PDF Import State
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    planName: '',
    price: '',
    frequency: 'Monthly' as 'Monthly' | 'Yearly',
    nextBillDate: new Date().toISOString().split('T')[0],
    category: 'Keep Active' as 'Keep Active' | 'For Testing',
    status: 'Active' as 'Active' | 'Paused',
    isEssential: false,
    notes: ''
  });

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'subscriptions'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubscriptions(snapshot.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          nextBillDate: data.nextBillDate?.toDate() || new Date()
        } as Subscription;
      }));
      setLoading(false);
    }, (err) => {
      console.error("Subscription feed failed:", err);
      setLoading(false);
    });
    return unsubscribe;
  }, [isAdmin]);

  const handleOpenAdd = () => {
    setEditingSub(null);
    setFormData({
      name: '',
      planName: '',
      price: '',
      frequency: 'Monthly',
      nextBillDate: new Date().toISOString().split('T')[0],
      category: 'Keep Active',
      status: 'Active',
      isEssential: false,
      notes: ''
    });
    setShowForm(true);
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setFormData({
      name: sub.name,
      planName: sub.planName,
      price: sub.price.toString(),
      frequency: sub.frequency,
      nextBillDate: sub.nextBillDate.toISOString().split('T')[0],
      category: sub.category,
      status: sub.status,
      isEssential: sub.isEssential,
      notes: sub.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subscription record?")) return;
    try {
      await deleteDoc(doc(db, 'subscriptions', id));
    } catch (e) {
      alert("Error deleting record.");
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      alert("Please fill in required fields.");
      return;
    }

    setIsSaving(true);
    const data = {
      name: formData.name,
      planName: formData.planName,
      price: parseFloat(formData.price),
      frequency: formData.frequency,
      nextBillDate: Timestamp.fromDate(new Date(formData.nextBillDate)),
      category: formData.category,
      status: formData.status,
      isEssential: formData.isEssential,
      notes: formData.notes,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingSub) {
        await updateDoc(doc(db, 'subscriptions', editingSub.id!), data);
      } else {
        await addDoc(collection(db, 'subscriptions'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      setShowForm(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save subscription.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Please upload a PDF file.");
      return;
    }

    setIsImporting(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      const parsedData = await parseSubscriptionsFromPDF(base64);

      if (parsedData.length === 0) {
        alert("No subscriptions detected in the PDF. Please check the file format.");
        return;
      }

      if (confirm(`Detected ${parsedData.length} subscriptions. Import them all?`)) {
        for (const sub of parsedData) {
          await addDoc(collection(db, 'subscriptions'), {
            ...sub,
            nextBillDate: Timestamp.now(), // Use current date as placeholder for PDF imports
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        alert("Successfully imported subscriptions.");
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to parse PDF. Ensure it contains a clear table of subscriptions.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isAdmin) return null;

  const totalMonthlyCost = subscriptions.reduce((acc, sub) => {
    if (sub.status !== 'Active') return acc;
    const monthlyPrice = sub.frequency === 'Yearly' ? sub.price / 12 : sub.price;
    return acc + monthlyPrice;
  }, 0);

  const filteredSubs = subscriptions.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.planName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['Keep Active', 'For Testing'];

  const CategorySection = ({ category }: { category: string }) => {
    const items = filteredSubs.filter(s => s.category === category);
    const categoryTotal = items.reduce((acc, sub) => {
      if (sub.status !== 'Active') return acc;
      const monthlyPrice = sub.frequency === 'Yearly' ? sub.price / 12 : sub.price;
      return acc + monthlyPrice;
    }, 0);

    if (items.length === 0 && !searchQuery) return null;

    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-3">
            {category === 'Keep Active' ? <Lock className="w-5 h-5 text-amber-500" /> : <Bot className="w-5 h-5 text-purple-500" />}
            <h3 className="text-xl font-bold dark:text-white">{category}</h3>
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Total: <span className="font-bold text-slate-900 dark:text-white">${categoryTotal.toFixed(2)}/mo</span>
          </div>
        </div>

        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {items.map(sub => (
            <div key={sub.id} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-indigo-400 dark:hover:border-indigo-500 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {sub.name}
                    {sub.isEssential && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{sub.planName}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  sub.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  {sub.status}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Price:</span>
                  <span className="font-bold dark:text-white">${sub.price.toFixed(2)} / {sub.frequency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Next Bill:</span>
                  <span className="font-medium dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {sub.nextBillDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {sub.notes && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl mb-6">
                  <p className="text-xs italic text-slate-500 dark:text-slate-400 line-clamp-2">{sub.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenEdit(sub)} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(sub.id!)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                AI Subscription Tracker
                <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-lg">v1.7.0</span>
              </h2>
              <p className="text-lg text-slate-500 dark:text-slate-400 mt-1">
                Total Estimated Monthly Cost: <span className="font-black text-indigo-600 dark:text-indigo-400">${totalMonthlyCost.toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportPdf} 
            accept=".pdf" 
            className="hidden" 
          />
          <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 transition-all text-sm">
            <FileDown className="w-4 h-4" /> Export Report
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 transition-all text-sm disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} 
            Import from PDF
          </button>
          <button 
            onClick={() => setShowReport(true)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 transition-all text-sm"
          >
            <PieChart className="w-4 h-4" />
          </button>
          <button onClick={handleOpenAdd} className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-500/20 transition-all text-xs uppercase tracking-widest">
            <Plus className="w-5 h-5" /> Add Service
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
            placeholder="Search services..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <CategorySection category="Keep Active" />
          <CategorySection category="For Testing" />
        </>
      )}

      {/* ADD/EDIT FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden border dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  {editingSub ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold dark:text-white">{editingSub ? 'Edit Subscription' : 'Add New AI Service'}</h3>
                  <p className="text-xs text-slate-500">Track internal tool expenditures</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Service Name</label>
                  <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. OpenAI, Midjourney" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Plan Name</label>
                  <input value={formData.planName} onChange={e => setFormData({...formData, planName: e.target.value})} placeholder="e.g. Pro, Team, Enterprise" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Price (USD)</label>
                  <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="20.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Frequency</label>
                  <select value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-bold">
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Next Billing Date</label>
                  <input type="date" value={formData.nextBillDate} onChange={e => setFormData({...formData, nextBillDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-bold">
                    <option value="Keep Active">Keep Active</option>
                    <option value="For Testing">For Testing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-bold">
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700">
                <input type="checkbox" id="essential" checked={formData.isEssential} onChange={e => setFormData({...formData, isEssential: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded border-slate-300" />
                <label htmlFor="essential" className="flex-1 cursor-pointer">
                   <p className="text-sm font-bold dark:text-white">Essential Workspace Tool</p>
                   <p className="text-[10px] text-slate-500">Flags this subscription as critical infrastructure.</p>
                </label>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Internal Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} placeholder="User counts, billing owner, etc..." className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 text-xs uppercase tracking-widest">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingSub ? 'Update Record' : 'Save Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Subscription Report</h3>
              <button onClick={() => setShowReport(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {categories.map(cat => {
                const items = subscriptions.filter(s => s.category === cat && s.status === 'Active');
                const catTotal = items.reduce((acc, sub) => acc + (sub.frequency === 'Yearly' ? sub.price / 12 : sub.price), 0);
                
                return (
                  <div key={cat} className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                      <h4 className="flex items-center gap-2 font-black text-slate-800 dark:text-white">
                        {cat === 'Keep Active' ? <Lock className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        {cat}
                      </h4>
                      <span className="text-sm font-bold text-slate-700 dark:text-white">Total: ${catTotal.toFixed(2)}/mo</span>
                    </div>
                    <div className="space-y-2">
                      {items.map(sub => (
                        <div key={sub.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl flex justify-between items-center group">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white truncate">{sub.name}</span>
                              <span className="px-1.5 py-0.5 bg-green-900/40 text-green-400 text-[8px] font-black uppercase rounded">Active</span>
                            </div>
                            <span className="text-[10px] text-slate-500">{sub.planName}</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">${sub.price.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-500">{sub.frequency}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
