import React, { useState, useRef } from 'react';
import { ShieldCheck, Upload, Loader2, AlertTriangle, ChevronDown, ChevronRight, FileText, Eye, Tag, AlertCircle } from 'lucide-react';
import { runThematicQA, ThematicQAResult } from './ai';

const RISK_CONFIG = {
  none: { label: 'None', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  low: { label: 'Low', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  moderate: { label: 'Moderate', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  high: { label: 'High', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
};

export const ThematicQA: React.FC = () => {
  const [theme, setTheme] = useState('');
  const [parsedText, setParsedText] = useState('');
  const [slideImages, setSlideImages] = useState<{ slide: number; dataUrl: string }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThematicQAResult | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    setParsing(true);
    setError(null);
    setParsedText('');
    setSlideImages([]);
    setFileName(file.name);
    setResult(null);

    try {
      const lib = await import('pdfjs-dist' as any);
      lib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
      const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
      const numPages = pdf.numPages;
      setPageCount(numPages);

      let text = '';
      const images: { slide: number; dataUrl: string }[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);

        // Extract text
        const content = await page.getTextContent();
        const pageText = content.items.map((it: any) => it.str).join(' ').trim();
        text += `[Slide ${i}]: ${pageText}\n\n`;

        // Render page to canvas → base64 image
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push({ slide: i, dataUrl: canvas.toDataURL('image/png') });
      }

      setParsedText(text.trim());
      setSlideImages(images);
    } catch (err: any) {
      console.error('PDF parse error:', err);
      setError(`Failed to parse PDF: ${err?.message || String(err)}`);
    } finally {
      setParsing(false);
    }
  };

  const handleRun = async () => {
    if (!theme.trim()) { setError('Please enter a theme to scan for.'); return; }
    if (!parsedText) { setError('Please upload a PDF first.'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runThematicQA(theme.trim(), parsedText, slideImages);
      setResult(res);
      setOpenSections({ keywords: true, text: true, visual: true });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const riskCfg = result ? (RISK_CONFIG[result.risk_level] ?? RISK_CONFIG.none) : null;

  const totalKeywords = result
    ? Object.values(result.generated_keywords).flat().length
    : 0;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-20">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Thematic QA</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Compliance-focused thematic content scanner</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">

        {/* Theme Input */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-black uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5" /> Theme to Scan For
          </label>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g. violence, gambling, political content..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
          <p className="text-[10px] text-slate-400 mt-2">Enter the specific theme you want to audit the lesson content against.</p>
        </div>

        {/* PDF Upload */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-black uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Lesson PDF
          </label>
          <div
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-500">Parsing PDF & rendering slides...</p>
              </div>
            ) : fileName ? (
              <div className="flex flex-col items-center gap-1">
                <FileText className="w-8 h-8 text-indigo-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{fileName}</p>
                <p className="text-[10px] text-slate-400">{pageCount} slides extracted · click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500">Click to upload PDF</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Run Button */}
      <div className="flex justify-center mb-8">
        <button
          onClick={handleRun}
          disabled={loading || parsing || !theme.trim() || !parsedText}
          className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black shadow-lg transition-all transform active:scale-95 text-xs uppercase tracking-widest ${
            loading || parsing || !theme.trim() || !parsedText
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:-translate-y-1'
          }`}
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Scanning...</>
          ) : (
            <><Eye className="w-5 h-5" /> Run Thematic Scan</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && riskCfg && (
        <div className="space-y-6">

          {/* Risk Banner */}
          <div className={`p-6 rounded-3xl border ${riskCfg.bg} ${riskCfg.border} flex items-center justify-between`}>
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${riskCfg.dot} flex-shrink-0`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Risk Level</span>
                  <span className={`text-lg font-black uppercase ${riskCfg.text}`}>{riskCfg.label}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{result.summary}</p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 space-y-1">
              <div><span className="font-bold text-slate-600 dark:text-slate-300">{result.text_matches.length}</span> text match{result.text_matches.length !== 1 ? 'es' : ''}</div>
              <div><span className="font-bold text-slate-600 dark:text-slate-300">{result.visual_matches.length}</span> visual match{result.visual_matches.length !== 1 ? 'es' : ''}</div>
              <div><span className="font-bold text-slate-600 dark:text-slate-300">{totalKeywords}</span> keywords generated</div>
            </div>
          </div>

          {/* Generated Keywords */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              onClick={() => toggleSection('keywords')}
            >
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" />
                Generated Keywords
                <span className="text-xs font-normal text-slate-400">({totalKeywords} total)</span>
              </span>
              {openSections.keywords ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {openSections.keywords && (
              <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                {(Object.entries(result.generated_keywords) as [string, string[]][]).map(([category, terms]) => (
                  terms.length > 0 && (
                    <div key={category}>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">{category.replace(/_/g, ' ')}</p>
                      <div className="flex flex-wrap gap-1">
                        {terms.map((term, i) => (
                          <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono rounded-md">
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Text Matches */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              onClick={() => toggleSection('text')}
            >
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                Text Matches
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${result.text_matches.length > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                  {result.text_matches.length}
                </span>
              </span>
              {openSections.text ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {openSections.text && (
              <div className="border-t border-slate-100 dark:border-slate-700">
                {result.text_matches.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400 italic">No text matches found.</p>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider w-16">Slide</th>
                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider w-32">Matched Term</th>
                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.text_matches.map((m, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                          <td className="px-4 py-3 font-mono text-slate-500">{m.slide}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold rounded">
                              {m.matched_term}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 leading-relaxed">{m.context}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Visual Matches */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              onClick={() => toggleSection('visual')}
            >
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-500" />
                Visual Matches
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${result.visual_matches.length > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                  {result.visual_matches.length}
                </span>
              </span>
              {openSections.visual ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {openSections.visual && (
              <div className="border-t border-slate-100 dark:border-slate-700">
                {result.visual_matches.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400 italic">No visual matches found.</p>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider w-16">Slide</th>
                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Matched Element</th>
                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider w-24">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.visual_matches.map((m, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                          <td className="px-4 py-3 font-mono text-slate-500">{m.slide}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{m.matched_element}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold rounded text-[10px] uppercase">
                              {m.confidence}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Raw JSON Export */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              onClick={() => toggleSection('json')}
            >
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-400" />
                Raw JSON Report
              </span>
              {openSections.json ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {openSections.json && (
              <div className="border-t border-slate-100 dark:border-slate-700 p-4">
                <pre className="text-[10px] font-mono text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                  {JSON.stringify({ ...result, generated_keywords: result.generated_keywords }, null, 2)}
                </pre>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center">
        <span className="text-[10px] text-slate-400 font-mono">Thematic QA v0.1.0</span>
      </div>
    </div>
  );
};
