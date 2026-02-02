
import React, { useState } from 'react';
import { ListOrdered, Trash2, Copy, Check, Play, Sparkles, ClipboardList, List } from 'lucide-react';

export const ListMerger: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [resultList, setResultList] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleProcess = () => {
    if (!inputText.trim()) return;

    // Aggressive splitting: commas, semicolons, newlines, tabs, and common grouping symbols
    // This ensures that "category (word1, word2)" is broken down correctly.
    const rawItems = inputText.split(/[,\n;\t\(\)\[\]\{\}]/);
    
    const seen = new Set<string>();
    const uniqueItems: string[] = [];

    rawItems.forEach(item => {
      const cleaned = item.trim();
      if (cleaned) {
        // Handle potential lingering internal quotes or artifacts
        const veryClean = cleaned.replace(/['"]/g, '').trim();
        if (veryClean) {
          const lower = veryClean.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            uniqueItems.push(veryClean);
          }
        }
      }
    });

    // Sort alphabetically
    setResultList(uniqueItems.sort((a, b) => a.localeCompare(b)));
  };

  const handleCopy = () => {
    if (resultList.length === 0) return;
    navigator.clipboard.writeText(resultList.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInputText('');
    setResultList([]);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 transition-colors">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-orange-500" />
            Simple List Merger
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Paste words separated by commas, semicolons, or lines. Handles messy inputs like brackets and lists.
          </p>
        </div>

        <div className="space-y-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your words here... e.g. cat, dog (bird, fish), snake; hamster"
            className="w-full h-48 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-inner focus:border-orange-500 focus:ring-orange-500 dark:focus:border-orange-400 p-4 text-sm resize-none transition-all placeholder:text-slate-400 font-mono"
          />
          
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={handleProcess}
              disabled={!inputText.trim()}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/10 transition-all flex items-center gap-2 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              Merge & Clean
            </button>
          </div>
        </div>
      </div>

      {resultList.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-teal-200 dark:border-teal-500/30 bg-teal-50/10 animate-fade-in-up transition-colors">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Cleaned List ({resultList.length})</h3>
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                copied 
                ? 'bg-teal-500 text-white' 
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy List'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-inner">
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {resultList.map((word, i) => (
                <div 
                  key={i} 
                  className="py-2.5 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-[10px] text-slate-400 font-mono w-8 text-right flex-shrink-0">{i + 1}.</span>
                  <span className="truncate">{word}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest px-2">
            <ClipboardList className="w-3 h-3" />
            Sorted Alphabetically • Deep Delimiter Cleaning
          </div>
        </div>
      )}
    </div>
  );
};
