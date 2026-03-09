import React, { useState, useEffect, useRef } from 'react';
import { FileText, Settings, AlertCircle, Copy, Check, Upload, Loader2, BookOpen, FileArchive, Presentation, ChevronDown, ChevronUp } from 'lucide-react';
import { fixTeacherNotes, type TNResult } from './ai';
import { ResultRenderer } from './ResultRenderer';
import { extractNotesFromPdf } from './parsers/pdfParser';
import { extractNotesFromPptx } from './parsers/pptxParser';
import { extractNotesFromSlidesZip } from './parsers/slidesZipParser';
import { buildTNReport, type TNReportContext } from './reportBuilder';
import { UnifiedToolSettingsModal } from '../UnifiedToolSettingsModal';
import { ReportViewer } from '../ReportViewer';
import { saveReport } from '../../services/reportService';
import { getToolConfig } from '../../services/toolConfig';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_SYSTEM_INSTRUCTION, TOOL_ID, TOOL_LABEL } from './constants';
import type { ToolReport } from '../../types/report';

type InputMode = 'single' | 'full-lesson';

const TN_STANDARDS = [
  'ABC: Accurate, Brief, Clear',
  'T. and S. Abbreviations Only',
  'No Scripts / Quotes',
  'Action-Oriented Phrasing',
  'Numbered Lists Only',
  'Extension Handling',
];

export const TNStandardiser: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [inputMode, setInputMode] = useState<InputMode>('single');
  const [originalTNs, setOriginalTNs] = useState('');
  const [result, setResult] = useState<TNResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [currentReport, setCurrentReport] = useState<ToolReport | null>(null);
  const [showReport, setShowReport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInfoRef = useRef<{ name: string; inputType: TNReportContext['inputType'] } | null>(null);

  useEffect(() => {
    getToolConfig(TOOL_ID).then(cfg => {
      setIsLocked(cfg.isLocked);
      if (cfg.prompt_template) setAdditionalInstructions(cfg.prompt_template);
    });
  }, []);

  const handleSettingsClose = () => {
    setShowSettings(false);
    getToolConfig(TOOL_ID).then(cfg => {
      setIsLocked(cfg.isLocked);
      if (cfg.prompt_template !== undefined) setAdditionalInstructions(cfg.prompt_template);
    });
  };

  const getActivePrompt = () =>
    additionalInstructions.trim()
      ? `${DEFAULT_SYSTEM_INSTRUCTION}\n\nADDITIONAL INSTRUCTIONS:\n${additionalInstructions}`
      : DEFAULT_SYSTEM_INSTRUCTION;

  const handleFix = async () => {
    if (!originalTNs.trim()) {
      setError('Please paste some teacher notes or upload a file.');
      return;
    }
    if (isLocked && !isAdmin) {
      setError('This tool is currently locked by an administrator.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentReport(null);
    setProgress(null);

    const activePrompt = getActivePrompt();
    const fileInfo = fileInfoRef.current;

    try {
      const isMultiSlide =
        inputMode === 'full-lesson' &&
        (originalTNs.includes('### SLIDE') || originalTNs.includes('Slide '));

      let finalResult: TNResult;
      let totalSlides = 1;
      let slidesFailed = 0;

      if (isMultiSlide) {
        const slides = originalTNs
          .split(/(?=### SLIDE \d+ ###|Slide \d+:|Slide \d+\n)/gi)
          .filter(s => s.trim());

        totalSlides = slides.length;
        setProgress({ current: 0, total: slides.length });

        const slidePromises = slides.map(async (slideText, slideIdx) => {
          const headerMatch = slideText.match(/^(### SLIDE \d+ ###|Slide \d+:|Slide \d+)/i);
          const originalHeader = headerMatch ? headerMatch[0] : `### SLIDE ${slideIdx + 1} ###`;
          const slideNum =
            originalHeader.replace(/###|SLIDE|Slide|:|#/gi, '').trim() ||
            (slideIdx + 1).toString();

          const tryFix = async (): Promise<TNResult> => {
            const res = await fixTeacherNotes(slideText, activePrompt);
            let fixedNotes = res.fixedNotes.trim();
            fixedNotes = fixedNotes.replace(/^(### SLIDE \d+ ###|Slide \d+:|Slide \d+)\s*/i, '');
            fixedNotes = fixedNotes.replace(/^Teacher Notes:\s*/i, '');
            return { ...res, fixedNotes: `Slide ${slideNum}\nTeacher Notes:\n${fixedNotes}` };
          };

          try {
            const res = await tryFix();
            setProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
            return { index: slideIdx, slideNum, res, failed: false };
          } catch (firstErr) {
            console.warn(`[TNStandardiser] Retrying slide ${slideNum}:`, firstErr);
            try {
              const res = await tryFix();
              setProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
              return { index: slideIdx, slideNum, res, failed: false };
            } catch (secondErr) {
              console.error(`[TNStandardiser] Slide ${slideNum} failed after retry:`, secondErr);
              setProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
              const fallback = slideText
                .replace(/^(### SLIDE \d+ ###|Slide \d+:|Slide \d+)\s*/i, '')
                .trim();
              return {
                index: slideIdx,
                slideNum,
                failed: true,
                res: {
                  fixedNotes: `Slide ${slideNum}\nTeacher Notes:\n${fallback}`,
                  fixLog: `Slide ${slideNum} failed to process. Original notes preserved.`,
                },
              };
            }
          }
        });

        const allResults = (await Promise.all(slidePromises)).sort((a, b) => a.index - b.index);
        slidesFailed = allResults.filter(r => r.failed).length;
        finalResult = {
          fixedNotes: allResults.map(r => r.res.fixedNotes).join('\n\n'),
          fixLog: allResults.map(r => `Slide ${r.slideNum}: ${r.res.fixLog}`).join('\n'),
        };
      } else {
        finalResult = await fixTeacherNotes(originalTNs, activePrompt);
      }

      setResult(finalResult);

      // ── Reporting (fire-and-forget — never blocks user flow) ─────────────
      if (user) {
        const ctx: TNReportContext = {
          userId: user.uid,
          inputType: fileInfo?.inputType ?? 'text',
          fileName: fileInfo?.name ?? null,
          totalSlides,
          slidesProcessed: totalSlides - slidesFailed,
          slidesFailed,
          finalOutput: finalResult.fixedNotes,
          model: null,
          promptVersion: additionalInstructions.trim() ? 'custom' : 'default',
        };
        const { localReport } = buildTNReport(ctx);
        setCurrentReport(localReport);
        setShowReport(false);
        saveReport({
          toolId: localReport.tool_id,
          userId: localReport.user_id,
          status: localReport.status,
          summary: localReport.summary,
          reportData: localReport.report_data,
          metadata: localReport.metadata,
        }).catch(e => console.warn('[TNStandardiser] saveReport failed (non-blocking):', e));
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase();
    setParsingFile(true);
    setError(null);
    setResult(null);
    setCurrentReport(null);

    try {
      let extracted = '';
      if (ext === 'pdf') {
        fileInfoRef.current = { name: file.name, inputType: 'pdf' };
        extracted = await extractNotesFromPdf(file);
      } else if (ext === 'pptx') {
        fileInfoRef.current = { name: file.name, inputType: 'pptx' };
        extracted = await extractNotesFromPptx(file);
      } else if (ext === 'zip') {
        fileInfoRef.current = { name: file.name, inputType: 'slides-zip' };
        extracted = await extractNotesFromSlidesZip(file);
      } else {
        throw new Error('Unsupported file format. Please upload a .pdf, .pptx, or .zip file.');
      }
      setOriginalTNs(extracted);
      setInputMode('full-lesson');
    } catch (err: any) {
      setError(err.message || 'Failed to parse file.');
    } finally {
      setParsingFile(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.fixedNotes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setOriginalTNs('');
    setResult(null);
    setError(null);
    setProgress(null);
    setCurrentReport(null);
    setShowReport(false);
    fileInfoRef.current = null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {TOOL_LABEL}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Standardise raw teacher notes to the Novakid ABC format.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left column — Input */}
        <div className="space-y-4">

          {/* Mode toggle */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Input Mode</p>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                {(['single', 'full-lesson'] as InputMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      inputMode === mode
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {mode === 'single' ? 'Single Slide' : 'Full Lesson'}
                  </button>
                ))}
              </div>
            </div>

            {/* File upload — full lesson only */}
            {inputMode === 'full-lesson' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors mb-4"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.pptx,.zip"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {parsingFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Reading file…</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-slate-400 mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Upload lesson file</p>
                    <div className="flex items-center gap-3 mt-2">
                      {[
                        { icon: <FileText className="w-3.5 h-3.5" />, label: 'PDF' },
                        { icon: <Presentation className="w-3.5 h-3.5" />, label: 'PPTX' },
                        { icon: <FileArchive className="w-3.5 h-3.5" />, label: 'Slides.com ZIP' },
                      ].map(f => (
                        <span key={f.label} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          {f.icon}{f.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <textarea
              value={originalTNs}
              onChange={e => setOriginalTNs(e.target.value)}
              rows={inputMode === 'full-lesson' ? 16 : 12}
              placeholder={
                inputMode === 'full-lesson'
                  ? '### SLIDE 1 ###\n[notes here]\n\n### SLIDE 2 ###\n[notes here]'
                  : 'Paste raw teacher notes for a single slide here…'
              }
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm leading-relaxed focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition-colors"
            />

            {/* Progress bar */}
            {progress && (
              <div className="mt-3">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-500 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1 text-center">
                  Processing {progress.current} / {progress.total} slides…
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleFix}
                disabled={loading || parsingFile || !originalTNs.trim()}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm uppercase tracking-widest"
              >
                {loading ? (
                  <><Loader2 className="animate-spin w-4 h-4" />Standardising…</>
                ) : (
                  <><BookOpen className="w-4 h-4" />Standardise Notes</>
                )}
              </button>
              {(originalTNs || result) && (
                <button
                  onClick={handleClear}
                  className="px-4 py-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-slate-200 dark:border-slate-700 rounded-xl transition-all text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Standards panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Novakid TN Standards</p>
            <div className="grid grid-cols-2 gap-2">
              {TN_STANDARDS.map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                  <div className="w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  {rule}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Output */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[480px]">

            {/* Output header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Standardised Result</p>
              {result && (
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20'
                  }`}
                >
                  {copied ? <><Check className="w-3.5 h-3.5" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy TNs</>}
                </button>
              )}
            </div>

            {/* Output body */}
            <div className="flex-1 p-6 overflow-y-auto max-h-[560px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full" />
                    <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">Standardising notes…</p>
                </div>
              ) : result ? (
                <ResultRenderer text={result.fixedNotes} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-slate-600">
                  <BookOpen className="w-12 h-12 mb-4 opacity-30" />
                  <p className="text-sm font-medium max-w-xs leading-relaxed">
                    Corrected Teacher Notes will appear here, formatted to Novakid ABC standards.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Fix log */}
          {result && (
            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl border border-slate-800 p-5">
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                Fix Log
              </p>
              <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans opacity-90">
                {result.fixLog}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Lite report panel — reporting layer validation */}
      {currentReport && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowReport(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors border-b border-slate-100 dark:border-slate-800"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Saved Report Preview
            </span>
            {showReport
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />}
          </button>
          {showReport && (
            <div className="p-4">
              <ReportViewer report={currentReport} />
            </div>
          )}
        </div>
      )}

      <UnifiedToolSettingsModal
        toolId={TOOL_ID}
        isOpen={showSettings}
        onClose={handleSettingsClose}
        defaultPrompt={additionalInstructions}
        lockedPromptDisplay={DEFAULT_SYSTEM_INSTRUCTION}
        toolLabel={TOOL_LABEL}
      />
    </div>
  );
};
