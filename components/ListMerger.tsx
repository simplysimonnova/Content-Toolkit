
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
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
          <ListOrdered className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Simple List Merger</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Paste words separated by commas, semicolons, or lines. Handles messy inputs like brackets and lists.
          </p>
        </div>
      </div>

      {/* Input Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">Input</label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your words here... e.g. cat, dog (bird, fish), snake; hamster"
            className="w-full h-48 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none p-4 text-sm resize-none transition-all placeholder:text-slate-400 font-mono"
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
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Merge & Clean
            </button>
          </div>
        </div>
      </div>

      {resultList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in-up">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Cleaned List ({resultList.length})</span>
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                copied
                ? 'bg-teal-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy List'}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {resultList.map((word, i) => (
              <div
                key={i}
                className="py-2.5 px-6 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-[10px] text-slate-400 font-mono w-8 text-right flex-shrink-0">{i + 1}.</span>
                <span className="truncate">{word}</span>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <ClipboardList className="w-3 h-3" />
            Sorted Alphabetically • Deep Delimiter Cleaning
          </div>
        </div>
      )}
    </div>
  );
};
