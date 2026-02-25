import React, { useState, useRef } from 'react';
import {
  ShieldCheck, Upload, Loader2,
  FileText, Eye, Tag, AlertCircle, Info, Settings, Layers, X,
  Play,
} from 'lucide-react';
import { runThematicQA } from './ai';
import { ThematicQAResult, BatchItem, QASettings } from './types';
import { ResultPanel, RISK_CONFIG } from './ResultPanel';
import { saveReport } from './firebaseService';
import { InfoModal } from './InfoModal';
import { SettingsModal, loadSettings, persistSettings } from './SettingsModal';
const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ─── PDF extraction helper ────────────────────────────────────────────────────
async function extractPDF(file: File): Promise<{ text: string; images: { slide: number; dataUrl: string }[]; pageCount: number }> {
  const lib = await import('pdfjs-dist' as any);
  lib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  const images: { slide: number; dataUrl: string }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += `[Slide ${i}]: ${content.items.map((it: any) => it.str).join(' ').trim()}\n\n`;
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    images.push({ slide: i, dataUrl: canvas.toDataURL('image/png') });
  }
  return { text: text.trim(), images, pageCount: pdf.numPages };
}

export const ThematicQA: React.FC = () => {
  const [settings, setSettings] = useState<QASettings>(() => loadSettings());
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ── Single mode state ──
  const [theme, setTheme] = useState(() => loadSettings().defaultTheme || '');
  const [parsedText, setParsedText] = useState('');
  const [slideImages, setSlideImages] = useState<{ slide: number; dataUrl: string }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThematicQAResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Batch mode state ──
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; stage: string } | null>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf')) { setError('Only PDF files are supported.'); return; }
    setParsing(true); setError(null); setParsedText(''); setSlideImages([]); setFileName(file.name); setResult(null);
    try {
      const { text, images, pageCount: pc } = await extractPDF(file);
      setParsedText(text); setSlideImages(images); setPageCount(pc);
    } catch (err: any) {
      setError(`Failed to parse PDF: ${err?.message || String(err)}`);
    } finally { setParsing(false); }
  };

  const handleRun = async () => {
    if (!theme.trim()) { setError('Please enter a theme to scan for.'); return; }
    if (!parsedText) { setError('Please upload a PDF first.'); return; }
    setLoading(true); setError(null); setResult(null);
    const t0 = Date.now();
    try {
      const res = await runThematicQA(theme.trim(), parsedText, slideImages, settings);
      setResult(res);
      if (settings.saveReportsAutomatically && settings.firebaseLoggingEnabled) {
        saveReport({
          theme: theme.trim(), file_name: fileName || 'unknown', file_source: 'upload', file_id: null,
          risk_level: res.risk_level, text_match_count: res.text_matches.length,
          visual_match_count: res.visual_matches.length, generated_keywords: res.generated_keywords,
          text_matches: res.text_matches, visual_matches: res.visual_matches, summary: res.summary,
          processing_time_ms: Date.now() - t0, status: 'success', error_message: null, batch_session_id: null,
        }).catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const handleBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = (Array.from(e.target.files ?? []) as File[]).filter(f => f.name.endsWith('.pdf'));
    if (!files.length) return;
    setBatchItems(prev => [...prev, ...files.map((f: File) => ({ id: genId(), fileName: f.name, source: 'upload' as const, file: f, status: 'pending' as const }))]);  
    setBatchDone(false);
    e.target.value = '';
  };

  const removeBatchItem = (id: string) => setBatchItems(p => p.filter(i => i.id !== id));

  const handleBatchRun = async () => {
    if (!theme.trim() || batchItems.length === 0) return;
    setBatchRunning(true); setBatchDone(false);
    const sessionId = genId();
    for (let idx = 0; idx < batchItems.length; idx++) {
      const item = batchItems[idx];
      if (!item.file) continue;
      const upd = (p: Partial<BatchItem>) => setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, ...p } : i));
      setBatchProgress({ current: idx + 1, total: batchItems.length, stage: 'Extracting PDF…' });
      upd({ status: 'extracting' });
      const t0 = Date.now();
      try {
        const { text, images } = await extractPDF(item.file);
        setBatchProgress({ current: idx + 1, total: batchItems.length, stage: 'Scanning…' });
        upd({ status: 'scanning' });
        const res = await runThematicQA(theme.trim(), text, images, settings);
        const report = {
          theme: theme.trim(), file_name: item.fileName, file_source: 'upload' as const, file_id: null,
          risk_level: res.risk_level, text_match_count: res.text_matches.length,
          visual_match_count: res.visual_matches.length, generated_keywords: res.generated_keywords,
          text_matches: res.text_matches, visual_matches: res.visual_matches, summary: res.summary,
          processing_time_ms: Date.now() - t0, status: 'success' as const, error_message: null, batch_session_id: sessionId,
        };
        if (settings.saveReportsAutomatically && settings.firebaseLoggingEnabled) {
          upd({ status: 'saving' });
          setBatchProgress({ current: idx + 1, total: batchItems.length, stage: 'Saving…' });
          await saveReport(report).catch(() => {});
        }
        upd({ status: 'done', report: { ...report, created_at: new Date() } as any });
      } catch (err: any) {
        console.error(`[Batch] ${item.fileName}:`, err);
        upd({ status: 'failed', error: err?.message || String(err) });
      }
    }
    setBatchRunning(false); setBatchDone(true); setBatchProgress(null);
  };

  const batchStats = {
    total: batchItems.length,
    success: batchItems.filter(i => i.status === 'done').length,
    failed: batchItems.filter(i => i.status === 'failed').length,
    dist: batchItems.filter(i => i.status === 'done').reduce((acc, i) => {
      const rl = i.report?.risk_level || 'none';
      acc[rl] = (acc[rl] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const STATUS_STYLE: Record<string, string> = {
    pending: 'text-slate-400', extracting: 'text-blue-500', scanning: 'text-indigo-500',
    saving: 'text-amber-500', done: 'text-green-600', failed: 'text-red-500',
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending', extracting: 'Extracting…', scanning: 'Scanning…',
    saving: 'Saving…', done: 'Done', failed: 'Failed',
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-20 space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20"><ShieldCheck className="w-8 h-8 text-white" /></div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Thematic QA</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Compliance-focused thematic content scanner</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            {(['single','batch'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${mode===m?'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white':'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                {m==='single'?<><Eye className="w-3.5 h-3.5"/>Single</>:<><Layers className="w-3.5 h-3.5"/>Batch</>}
              </button>
            ))}
          </div>
          <button onClick={()=>setShowSettings(true)} title="Settings" className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"><Settings className="w-5 h-5"/></button>
          <button onClick={()=>setShowInfo(true)} title="About" className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"><Info className="w-5 h-5"/></button>
        </div>
      </div>

      {/* Theme — shared */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <label className="block text-xs font-black uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2"><Tag className="w-3.5 h-3.5"/>Theme to Scan For</label>
        <input type="text" value={theme} onChange={e=>setTheme(e.target.value)} onKeyDown={e=>mode==='single'&&e.key==='Enter'&&handleRun()}
          placeholder="e.g. violence, gambling, political content..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"/>
      </div>

      {/* ── SINGLE MODE ── */}
      {mode==='single' && (<>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-black uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2"><FileText className="w-3.5 h-3.5"/>Lesson PDF</label>
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-400 transition-colors" onClick={()=>fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileUpload}/>
            {parsing
              ?<div className="flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin"/><p className="text-xs text-slate-500">Parsing PDF & rendering slides…</p></div>
              :fileName
                ?<div className="flex flex-col items-center gap-1"><FileText className="w-8 h-8 text-indigo-500 mx-auto"/><p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{fileName}</p><p className="text-[10px] text-slate-400">{pageCount} slides · click to replace</p></div>
                :<div className="flex flex-col items-center gap-2"><Upload className="w-8 h-8 text-slate-400 mx-auto"/><p className="text-xs text-slate-500">Click to upload PDF</p></div>}
          </div>
        </div>
        {error&&<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-500 shrink-0"/><p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p></div>}
        <div className="flex justify-center">
          <button onClick={handleRun} disabled={loading||parsing||!theme.trim()||!parsedText}
            className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest ${loading||parsing||!theme.trim()||!parsedText?'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed':'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:-translate-y-0.5'}`}>
            {loading?<><Loader2 className="w-5 h-5 animate-spin"/>Scanning…</>:<><Eye className="w-5 h-5"/>Run Thematic Scan</>}
          </button>
        </div>
        {result&&<ResultPanel result={result}/>}
      </>)}

      {/* ── BATCH MODE ── */}
      {mode==='batch' && (<>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2"><Layers className="w-3.5 h-3.5"/>Files ({batchItems.length})</label>
            <button onClick={()=>batchFileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black hover:bg-indigo-100 transition-all">
              <Upload className="w-3.5 h-3.5"/>Add PDFs
            </button>
            <input ref={batchFileRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleBatchFiles}/>
          </div>
          {batchItems.length===0
            ?<div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center text-slate-400 cursor-pointer hover:border-indigo-400 transition-colors" onClick={()=>batchFileRef.current?.click()}>
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Click to add multiple PDF files</p>
              </div>
            :<div className="space-y-2">{batchItems.map(item=>(
                <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0"/>
                  <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{item.fileName}</span>
                  <span className={`text-xs font-bold uppercase ${STATUS_STYLE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                  {item.status==='failed'&&<span className="text-[10px] text-red-400 max-w-[120px] truncate" title={item.error}>{item.error}</span>}
                  {item.report&&<span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${RISK_CONFIG[item.report.risk_level]?.bg} ${RISK_CONFIG[item.report.risk_level]?.text}`}>{item.report.risk_level}</span>}
                  {!batchRunning&&item.status==='pending'&&<button onClick={()=>removeBatchItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-4 h-4"/></button>}
                </div>
              ))}</div>
          }
        </div>

        {batchRunning&&batchProgress&&(
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500"/>{batchProgress.stage}</span>
              <span className="font-mono">{batchProgress.current} / {batchProgress.total}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{width:`${(batchProgress.current/batchProgress.total)*100}%`}}/>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button onClick={handleBatchRun} disabled={batchRunning||!theme.trim()||batchItems.length===0}
            className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest ${batchRunning||!theme.trim()||batchItems.length===0?'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed':'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:-translate-y-0.5'}`}>
            {batchRunning?<><Loader2 className="w-5 h-5 animate-spin"/>Processing…</>:<><Play className="w-5 h-5 fill-current"/>Run Batch Scan</>}
          </button>
        </div>

        {batchDone&&(
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Batch Summary</p>
            <div className="grid grid-cols-3 gap-3">
              {[{label:'Total',val:batchStats.total,cls:'text-slate-700 dark:text-slate-200'},{label:'Successful',val:batchStats.success,cls:'text-green-600'},{label:'Failed',val:batchStats.failed,cls:'text-red-500'}].map(({label,val,cls})=>(
                <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700">
                  <p className={`text-2xl font-black ${cls}`}>{val}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {Object.keys(batchStats.dist).length>0&&(
              <div className="flex flex-wrap gap-2">{Object.entries(batchStats.dist).map(([rl,count])=>(
                <span key={rl} className={`px-3 py-1 rounded-xl text-xs font-black uppercase ${RISK_CONFIG[rl as keyof typeof RISK_CONFIG]?.bg} ${RISK_CONFIG[rl as keyof typeof RISK_CONFIG]?.text}`}>{rl}: {count}</span>
              ))}</div>
            )}
          </div>
        )}
      </>)}

      {/* Footer */}
      <div className="mt-4 text-center">
        <span className="text-[10px] text-slate-400 font-mono">Thematic QA v1.0.0</span>
      </div>

      <InfoModal isOpen={showInfo} onClose={()=>setShowInfo(false)}/>
      <SettingsModal isOpen={showSettings} onClose={()=>setShowSettings(false)} settings={settings} onChange={s=>{setSettings(s);persistSettings(s);}}/>
    </div>
  );
};
