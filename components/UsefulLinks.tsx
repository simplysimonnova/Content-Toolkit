
import React, { useState, useEffect } from 'react';
import { Link2, Search, LayoutGrid, List, ExternalLink, Filter, Loader2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ResourceLink } from '../types';

export const UsefulLinks: React.FC = () => {
  const [links, setLinks] = useState<ResourceLink[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Exact collection name as used in AdminConsoleModal
    const linksCollection = collection(db, 'resource_links');
    const q = query(linksCollection, orderBy('name', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLinks = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as ResourceLink));
      setLinks(fetchedLinks);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching resource links:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const categories = ['All', ...Array.from(new Set(links.map(l => l.category).filter(Boolean)))];

  const filteredLinks = links.filter(link => {
    const name = link.name || '';
    const desc = link.description || '';
    const cat = link.category || '';
    
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || cat === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Link2 className="w-7 h-7 text-orange-500" />
            Useful Links
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Directory of educational resources and Metabase dashboards.</p>
        </div>

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
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeCategory === cat 
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
           <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
           <p className="text-slate-500 font-medium">Loading resources...</p>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
           <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
           <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">No resources found</h3>
           <p className="text-slate-500 mt-2">Try adjusting your filters or search terms.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLinks.map(link => (
            <a 
              key={link.id} 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                    {link.category}
                  </span>
                  <ExternalLink className="w-5 h-5 text-slate-300 group-hover:text-orange-500 transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{link.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3">{link.description}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex items-center text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-tighter">
                Open Resource
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y dark:divide-slate-700">
          {filteredLinks.map(link => (
            <a 
              key={link.id} 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 flex-shrink-0">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate">{link.name}</h3>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{link.category}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{link.description}</p>
              </div>
              <ExternalLink className="w-5 h-5 text-slate-300 group-hover:text-orange-500" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
