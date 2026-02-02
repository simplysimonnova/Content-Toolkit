import React, { useState, useEffect } from 'react';
import { Hash, Copy, Check, Trash2, Link2, Search, Info, ExternalLink, Globe } from 'lucide-react';

export const ClassIdFinder: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [classId, setClassId] = useState<string | null>(null);
  const [idCopied, setIdCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!inputUrl.trim()) {
      setClassId(null);
      return;
    }

    // Extraction logic: Look for a 7-12 digit number in the path
    // e.g., /classroom-unified/102975431/view
    const regex = /\/(\d{7,12})\//;
    const match = inputUrl.match(regex);
    
    if (match && match[1]) {
      setClassId(match[1]);
    } else {
      // Fallback: try to find any long numeric string if the standard path pattern fails
      const fallbackRegex = /(\d{8,10})/;
      const fallbackMatch = inputUrl.match(fallbackRegex);
      setClassId(fallbackMatch ? fallbackMatch[1] : null);
    }
  }, [inputUrl]);

  const adminLink = classId ? `https://admin.novakidschool.com/admin_resources/classes/show/${classId}#Class` : null;

  const handleCopyId = () => {
    if (classId) {
      navigator.clipboard.writeText(classId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (adminLink) {
      navigator.clipboard.writeText(adminLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setInputUrl('');
    setClassId(null);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-2xl text-orange-600 dark:text-orange-400">
            <Hash className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">Class ID Finder</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Extract and transform classroom identifiers instantly.</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Input Area */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] mb-3 ml-1">
              1. Paste Unified Link
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-4 text-slate-300 group-focus-within:text-orange-500 transition-colors">
                <Link2 className="w-5 h-5" />
              </div>
              <textarea
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://school.novakidschool.com/classroom-unified/..."
                className="w-full h-24 pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-0 text-sm font-mono transition-all resize-none placeholder:text-slate-400/60"
              />
              {inputUrl && (
                <button 
                  onClick={handleClear}
                  className="absolute right-4 bottom-4 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-md text-slate-400 hover:text-red-500 transition-all border border-slate-100 dark:border-slate-700"
                  title="Clear Input"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Extracted ID Area */}
            <div className="space-y-3">
               <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">
                2. Extracted ID
              </label>
              
              {!classId && inputUrl.trim() ? (
                 <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                    <Search className="w-6 h-6 text-slate-200 mb-2" />
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No ID detected</p>
                 </div>
              ) : !classId ? (
                 <div className="p-6 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center text-slate-300 dark:text-slate-600">
                    <Hash className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-[10px] font-medium">Waiting...</p>
                 </div>
              ) : (
                <div className="relative animate-fade-in-up">
                  <div className="p-6 rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/50 flex flex-col items-center justify-center shadow-inner group">
                    <span className="text-2xl font-black text-orange-600 dark:text-orange-400 tracking-tight tabular-nums">
                      {classId}
                    </span>
                    <button
                      onClick={handleCopyId}
                      className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
                        idCopied 
                          ? 'bg-teal-500 text-white shadow-teal-500/20' 
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-orange-500 hover:text-white'
                      }`}
                    >
                      {idCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {idCopied ? 'Copied' : 'Copy ID'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Shortcut Area */}
            <div className="space-y-3">
               <label className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">
                3. Admin Shortcut
              </label>
              
              {!adminLink ? (
                 <div className="p-6 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center text-slate-300 dark:text-slate-600">
                    <Globe className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-[10px] font-medium">Shortcut ready...</p>
                 </div>
              ) : (
                <div className="relative animate-fade-in-up">
                  <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 flex flex-col items-center justify-center shadow-inner group">
                    <a 
                      href={adminLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      title="Open in Admin"
                    >
                      <ExternalLink className="w-8 h-8" />
                    </a>
                    <button
                      onClick={handleCopyLink}
                      className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
                        linkCopied 
                          ? 'bg-teal-500 text-white shadow-teal-500/20' 
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-500 hover:text-white'
                      }`}
                    >
                      {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                      {linkCopied ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700/80 dark:text-blue-400/80 leading-relaxed font-medium">
              Extraction identifies the 7-12 digit numeric sequence in the URL path. Use the <strong>Extracted ID</strong> for technical lookups or the <strong>Admin Shortcut</strong> for direct access to class resources.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};