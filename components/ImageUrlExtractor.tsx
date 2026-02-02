
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
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 transition-colors">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Search className="w-6 h-6 text-orange-500" />
            Image URL Extractor
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Paste HTML code from Slides.com (or any source) to extract all clickable image links automatically.
          </p>
        </div>

        <div className="space-y-4">
          <textarea
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Paste code snippet here..."
            className="w-full min-h-[200px] rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-orange-500 focus:ring-orange-500 dark:focus:border-orange-400 p-3 font-mono text-sm resize-y transition-colors"
          />
          
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={handleExtract}
              disabled={!inputCode.trim()}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Extract Images
            </button>
          </div>
        </div>
      </div>

      {extractedUrls.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 animate-fade-in-up transition-colors">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
            Extracted Links ({extractedUrls.length})
          </h3>
          <div className="space-y-3">
            {extractedUrls.map((url, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 group hover:border-orange-200 dark:hover:border-orange-900/50 transition-colors"
              >
                <div className="w-10 h-10 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                  <img src={url} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline truncate block"
                  >
                    {url}
                  </a>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(url, index)}
                    className="p-2 text-slate-400 hover:text-orange-500 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-all"
                    title="Copy Link"
                  >
                    {copiedIndex === index ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-orange-500 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-all"
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
