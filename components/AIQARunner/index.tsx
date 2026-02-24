import React, { useState, useRef } from 'react';
import { ShieldCheck, Upload, FileText, Zap, XCircle, AlertTriangle, Info, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizePagesGSlides, normalizePagesSlidescom } from '../../services/pdfNormalizer';
import { runDeterministicChecks } from '../../services/deterministicChecks';
import { runQAEngine } from '../../services/qaEngine';
import { ResultDisplay } from './ResultDisplay';
import { AIQAInfoModal } from './AIQAInfoModal';
import { AIQASettingsModal } from './AIQASettingsModal';
import type { QAMode, PDFSourceType, ProgressStage, QARun } from './types';
import { PROGRESS_LABELS } from './types';

const STAGES_ORDERED: ProgressStage[] = [
  'uploading', 'normalizing', 'deterministic', 'ai-review', 'saving', 'complete',
];

const ProgressBar: React.FC<{ stage: ProgressStage }> = ({ stage }) => {
  const currentIdx = STAGES_ORDERED.indexOf(stage);
  return (
    <div className="space-y-3 w-full max-w-md">
      <div className="flex gap-1">
        {STAGES_ORDERED.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i < currentIdx
                ? 'bg-indigo-600'
                : i === currentIdx
                ? 'bg-indigo-400 animate-pulse'
                : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 text-center animate-pulse">
        {PROGRESS_LABELS[stage]}
      </p>
    </div>
  );
};

export const AIQARunner: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [mode, setMode] = useState<QAMode>('full-lesson');
  const [sourceType, setSourceType] = useState<PDFSourceType>('gslides');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [stage, setStage] = useState<ProgressStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deterministicFlags, setDeterministicFlags] = useState<string[]>([]);
  const [result, setResult] = useState<QARun | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      setError(null);
    } else {
      setError('Only PDF files are supported.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected?.type === 'application/pdf') {
      setFile(selected);
      setError(null);
    } else {
      setError('Only PDF files are supported.');
    }
  };

  const handleReset = () => {
    setStage('idle');
    setResult(null);
    setRunId(null);
    setFile(null);
    setTitle('');
    setDeterministicFlags([]);
    setError(null);
  };

  const handleRun = async () => {
    if (!file) { setError('Please upload a PDF.'); return; }
    if (!title.trim()) { setError('Please enter a lesson title.'); return; }
    if (!user) { setError('You must be logged in to run QA.'); return; }

    console.log('[AIQARunner] Starting QA run:', { file: file.name, title, mode, sourceType });
    setError(null);
    setResult(null);
    setDeterministicFlags([]);

    try {
      setStage('uploading');
      await new Promise(r => setTimeout(r, 300));

      setStage('normalizing');
      // Extract raw pages using proven TNStandardizer pattern directly in component
      const lib = await import('pdfjs-dist' as any);
      lib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
      const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
      const rawPages: { pageNumber: number; text: string; itemCount: number; avgFontSize: number }[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const items = content.items as any[];
        const text = items.map((it: any) => it.str).join(' ').replace(/\s+/g, ' ').trim();
        const fontSizes = items.filter((it: any) => it.height > 0).map((it: any) => it.height as number);
        const avgFontSize = fontSizes.length > 0 ? fontSizes.reduce((a: number, b: number) => a + b, 0) / fontSizes.length : 0;
        rawPages.push({ pageNumber: i, text, itemCount: items.length, avgFontSize });
      }
      const normalized = sourceType === 'gslides'
        ? normalizePagesGSlides(rawPages)
        : normalizePagesSlidescom(rawPages);

      if (normalized.slides.length === 0) {
        throw new Error('Could not extract any slides from the PDF. Please check the file and try again.');
      }

      setStage('deterministic');
      const checks = runDeterministicChecks(normalized.slides, mode, title);
      setDeterministicFlags(checks.flags);

      if (checks.criticalFail) {
        setStage('error');
        setError(
          `Critical structural issues detected — AI review blocked:\n${checks.flags.map(f => `• ${f}`).join('\n')}`
        );
        return;
      }

      setStage('ai-review');
      const notesCount = normalized.slides.filter(
        s => s.speakerNotes && s.speakerNotes.trim().length > 0
      ).length;

      const { runId: id, run } = await runQAEngine(
        normalized.slides,
        mode,
        title,
        sourceType,
        checks.flags,
        notesCount
      );

      setStage('saving');
      await new Promise(r => setTimeout(r, 400));

      setRunId(id);
      setResult(run);
      setStage('complete');

    } catch (err: any) {
      console.error('[AIQARunner]', err);
      setStage('error');
      setError(err.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const isRunning = !['idle', 'complete', 'error'].includes(stage);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Run AI QA
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Upload a lesson PDF and run a structured AI quality review.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(true)}
            className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
            title="About this tool"
          >
            <Info className="w-5 h-5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl transition-all"
              title="QA Prompt Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Input form — shown on idle or error */}
      {(stage === 'idle' || stage === 'error') && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Input</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                Lesson Title
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. U10-L2 Farm Animals"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
              />
            </div>

            {/* QA Mode */}
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                QA Mode
              </label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as QAMode)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              >
                <option value="full-lesson">Full Lesson QA</option>
                <option value="chunk-qa">Chunk QA</option>
                <option value="stem-qa">STEM QA</option>
                <option value="post-design-qa">Post-Design QA</option>
              </select>
            </div>

            {/* Source Type */}
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                PDF Source Type
              </label>
              <select
                value={sourceType}
                onChange={e => setSourceType(e.target.value as PDFSourceType)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              >
                <option value="gslides">Google Slides (GSlides export)</option>
                <option value="slidescom">Slides.com export</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Choose the platform the PDF was exported from so we can pair slides and notes correctly.
              </p>
            </div>

            {/* PDF Upload */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                Lesson PDF
              </label>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                    : file
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-emerald-500" />
                    <p className="font-bold text-sm text-emerald-700 dark:text-emerald-400">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB — click to replace
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-slate-400">
                      Upload your lesson PDF export. We will extract slides and speaker notes automatically.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Non-critical flags from a previous blocked run */}
          {stage === 'error' && deterministicFlags.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
              <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">
                Structural Issues Detected
              </p>
              {deterministicFlags.map((f, i) => (
                <p key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{f}
                </p>
              ))}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400 whitespace-pre-line">{error}</p>
            </div>
          )}

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={!file || !title.trim()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Run AI QA
          </button>
        </div>
      )}

      {/* Progress state */}
      {isRunning && (
        <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center gap-8">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full" />
            <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <ShieldCheck className="absolute inset-0 m-auto w-8 h-8 text-indigo-300" />
          </div>
          <ProgressBar stage={stage} />
          {deterministicFlags.length > 0 && (
            <div className="w-full max-w-md p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">
                Warnings (non-blocking)
              </p>
              {deterministicFlags.map((f, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-300">• {f}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {stage === 'complete' && result && runId && (
        <ResultDisplay result={result} runId={runId} onReset={handleReset} />
      )}

      {/* Footer */}
      <div className="text-center pb-2">
        <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">
          AI QA Runner v0.1.0
        </span>
      </div>

      <AIQAInfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
      <AIQASettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};
