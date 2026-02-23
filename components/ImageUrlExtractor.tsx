
import React, { useState } from 'react';
import { Search, ExternalLink, Copy, Check, Trash2 } from 'lucide-react';

export const ImageUrlExtractor: React.FC = () => {
  const [inputCode, setInputCode] = useState('');
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleExtract = () => {
    if (!inputCode.trim()) return;

    // Use DOMParser to safely extract image srcs from HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(inputCode, 'text/html');
    const images = doc.querySelectorAll('img');
    const urls = Array.from(images)
      .map(img => img.getAttribute('src'))
      .filter((src): src is string => !!src);

    setExtractedUrls(urls);
  };

  const handleCopy = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClear = () => {
    setInputCode('');
    setExtractedUrls([]);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
          <Search className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Image URL Extractor</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Paste HTML code from Slides.com (or any source) to extract all clickable image links automatically.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">HTML Source</label>
          <textarea
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Paste code snippet here..."
            className="w-full min-h-[200px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none p-4 font-mono text-sm resize-y transition-all"
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
              onClick={handleExtract}
              disabled={!inputCode.trim()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Extract Images
            </button>
          </div>
        </div>
      </div>

      {extractedUrls.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in-up">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Extracted Links ({extractedUrls.length})</span>
          </div>
          <div className="p-6 space-y-3">
            {extractedUrls.map((url, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                  <img src={url} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                  >
                    {url}
                  </a>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(url, index)}
                    className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                    title="Copy Link"
                  >
                    {copiedIndex === index ? <Check className="w-4 h-4 text-teal-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                    title="Open Image"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
