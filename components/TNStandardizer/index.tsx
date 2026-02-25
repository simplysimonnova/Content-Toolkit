import React, { useState, useEffect, useRef } from 'react';
import { FileText, Settings, Info, AlertTriangle, Copy, Check, Upload, Loader2, Shield } from 'lucide-react';
import { fixTeacherNotes } from './ai';
import { TNInfoModal } from './TNInfoModal';
import { UnifiedToolSettingsModal } from '../UnifiedToolSettingsModal';
import { getToolConfig } from '../../services/toolConfig';
import { saveReport } from '../../services/reportService';
import { ReportViewer } from '../ReportViewer';
import { useAuth } from '../../context/AuthContext';
import type { ToolReport, ReportData } from '../../types/report';

const LOCKED_PROMPT = `ROLE
You are "Novakid Teacher Notes Fixer Bot." Your job is to rewrite Teacher Notes (TNs) into the correct Novakid TN format using the rules below.

TASK
Rewrite Teacher Notes (TNs) following the strict Novakid conventions provided.

OUTPUT REQUIREMENTS (STRICT)
You MUST output a JSON object with two fields: "fixedNotes" and "fixLog".

1) "fixedNotes":
- Use SLIDE HEADERS: "### SLIDE [N] ###" to separate slides in full lesson mode.
- Use multi-step numbering: 1, 2, 3 (no dots, no TN1).
- Use abbreviations: T (Teacher) and S (Student) - NO DOTS.
- Include timings (mins/secs) for non-chunked lessons (unless < 30s).
- Use specific labels: "Quick slide", "Title slide", "Warm-up", "Drag and Drop", "Extension slide", etc.
- Multi-fragment slides: Specify "Last fragment: ____".

2) "fixLog":
- Concise explanation of violations found and changes made.

BOT PROMPT: Teacher Notes (TN) Conventions

1) General TN formatting
- TNs should generally be numbered (1, 2...) and written in a step-by-step format.
- If there is only one step, numbering is optional.
- TNs must be as concise as possible, but still clear.
- Intuitive slides: write only "Quick slide".

2) Timings
- Non-chunked lessons: each slide must include a timing in mins or secs (do NOT use ">").
- Timing < 30s: write "Quick slide" instead of timing.
- Extension slides: label "Extension slide" (no timing).

3) Chunked lessons
- On the first main slide of each chunk (NOT title/warm-up), include: "Chunk X (Y slides). Z mins".

4) Required labels (Exact strings):
- Title slide: "Title slide. Do not spend time here. Move straight to next slide."
- Vertical slide (1.2): "For teacher use only."
- Warm-up slide: "Warm-up"
- Self-evaluation slides: "Self-evaluation slide"
- Drag and Drop slides: "Drag and Drop"
- Extension slides: "Extension slide"

5) Abbreviations:
- Teacher -> T
- Student -> S

6) Multi-step instructions:
- Each instruction on a separate line.
- Number them 1, 2, 3
- Steps must be truly sequential.

7) Multiple fragments:
- Specify last fragment: "Last fragment: ____"

QUALITY CHECK:
- Section 1: Teacher Notes (numbering 1, 2, 3, T/S only, labels, SLIDE headers).
- Section 2: Fix Log (What & Why).`;

const STANDARDS = [
  'ABC: Accurate, Brief, Clear',
  'T and S (No Dots)',
  '1, 2, 3... Numbering',
  'Concise Phrasing',
  'Timings & Labels',
  'Last Fragment Tracking',
];

export const TNStandardizer: React.FC = () => {
  const { isAdmin, user } = useAuth();

  const [originalTNs, setOriginalTNs] = useState('');
  const [report, setReport] = useState<ToolReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fixedNotesRef = useRef<string>('');
  const [isFullLesson, setIsFullLesson] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getToolConfig('tn-standardizer').then(cfg => {
      setIsLocked(cfg.isLocked);
      if (cfg.prompt_template) setAdditionalInstructions(cfg.prompt_template);
    });
  }, []);

  const activePrompt = additionalInstructions.trim()
    ? `${LOCKED_PROMPT}\n\n--- Additional Admin Instructions ---\n${additionalInstructions.trim()}`
    : LOCKED_PROMPT;

  const handleFix = async () => {
    if (!originalTNs.trim()) { setError('Please paste some teacher notes or upload a file to fix.'); return; }
    setLoading(true); setError(null); setReport(null);
    try {
      const tnResult = await fixTeacherNotes(originalTNs, activePrompt);
      fixedNotesRef.current = tnResult.fixedNotes;

      const reportData: ReportData = {
        sections: [
          {
            type: 'summary',
            title: 'TN Standardization Result',
            status: 'success',
            text: `Successfully standardized ${isFullLesson ? 'full lesson' : 'single slide'} teacher notes.`,
          },
          {
            type: 'text',
            title: 'Standardized Notes',
            content: tnResult.fixedNotes,
          },
          {
            type: 'text',
            title: 'Fix Log',
            content: tnResult.fixLog,
          },
        ],
      };

      const savedId = await saveReport({
        toolId: 'tn-standardizer',
        userId: user?.uid ?? 'anonymous',
        status: 'success',
        summary: `Standardized ${isFullLesson ? 'full lesson' : 'single slide'} TN.`,
        reportData,
      });

      setReport({
        id: savedId ?? undefined,
        tool_id: 'tn-standardizer',
        user_id: user?.uid ?? 'anonymous',
        created_at: new Date().toISOString(),
        status: 'success',
        summary: `Standardized ${isFullLesson ? 'full lesson' : 'single slide'} TN.`,
        report_data: reportData,
        schema_version: '1.0',
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') await extractPdf(file);
    else if (ext === 'pptx') await extractPptx(file);
    else setError('Unsupported file format. Please upload a .pdf or .pptx file.');
  };

  const extractPdf = async (file: File) => {
    setParsingFile(true); setError(null);
    try {
      const lib = await import('pdfjs-dist' as any);
      lib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
      const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += `### SLIDE ${i} ###\n${content.items.map((it: any) => it.str).join(' ')}\n\n`;
      }
      setOriginalTNs(text.trim()); setIsFullLesson(true);
    } catch { setError('Failed to parse PDF. Please try again or paste text manually.'); }
    finally { setParsingFile(false); }
  };

  const extractPptx = async (file: File) => {
    setParsingFile(true); setError(null);
    try {
      const mod = await import('jszip' as any);
      const JSZip = mod.default || mod;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const slideFiles: string[] = Object.keys(zip.files)
        .filter((n: string) => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'))
        .sort((a: string, b: string) =>
          parseInt(a.match(/slide(\d+)/)?.[1] || '0') - parseInt(b.match(/slide(\d+)/)?.[1] || '0')
        );
      if (!slideFiles.length) throw new Error('No slides found.');
      const domParser = new DOMParser();
      let text = '';
      for (const sf of slideFiles) {
        const xml = domParser.parseFromString(await zip.file(sf)!.async('string'), 'text/xml');
        const nodes = xml.getElementsByTagName('a:t');
        let slideText = '';
        for (let j = 0; j < nodes.length; j++) slideText += nodes[j].textContent + ' ';
        text += `### SLIDE ${sf.match(/slide(\d+)/)?.[1]} ###\n${slideText.trim()}\n\n`;
      }
      setOriginalTNs(text.trim()); setIsFullLesson(true);
    } catch { setError('Failed to parse PowerPoint. Please ensure it is a valid .pptx file.'); }
    finally { setParsingFile(false); }
  };

  const handleCopy = () => {
    if (!fixedNotesRef.current) return;
    navigator.clipboard.writeText(fixedNotesRef.current);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleSettingsClose = () => {
    setShowSettings(false);
    getToolConfig('tn-standardizer').then(cfg => {
      setIsLocked(cfg.isLocked);
      if (cfg.prompt_template !== undefined) setAdditionalInstructions(cfg.prompt_template);
    });
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <FileText className="w-8 h-8 text-white" />
            </div>
            {isLocked && <Shield className="w-3.5 h-3.5 text-indigo-500 absolute -top-1 -right-1" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              TN Standardization
              {isLocked && (
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">Stable</span>
              )}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Reformat Teacher Notes into strict Novakid TN conventions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInfo(true)} className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all" title="About this tool">
            <Info className="w-5 h-5" />
          </button>
          {isAdmin && (
            <button onClick={() => setShowSettings(true)} className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Input */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
            {/* Full Lesson Toggle */}
            <div className="absolute top-5 right-5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-[10px] font-black text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">Full Lesson Mode</span>
                <div
                  onClick={() => setIsFullLesson(v => !v)}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${isFullLesson ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${isFullLesson ? 'translate-x-5' : ''}`} />
                </div>
              </label>
            </div>

            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-5">
              <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              Input Content
            </h2>

            <div className="space-y-4">
              {isFullLesson && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.pptx" onChange={handleFileChange} />
                  {parsingFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                      <p className="text-sm font-bold text-indigo-600">Reading File...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Upload className="w-6 h-6 text-indigo-500" />
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Upload PDF or PowerPoint</p>
                      <p className="text-xs text-slate-400 mt-1">Automatic slide-by-slide extraction</p>
                    </>
                  )}
                </div>
              )}

              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isFullLesson ? 'Review extracted notes or paste multiple slide notes below.' : 'Paste single slide notes or description below.'}
              </p>

              <textarea
                value={originalTNs}
                onChange={e => setOriginalTNs(e.target.value)}
                rows={isFullLesson ? 18 : 14}
                placeholder={isFullLesson ? 'Slide 1: ...\nSlide 2: ...' : 'Paste raw teacher notes here...'}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm leading-relaxed resize-none"
              />

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                onClick={handleFix}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                {loading ? 'Processing...' : isFullLesson ? 'Process Full Lesson' : 'Fix Teacher Notes'}
              </button>
            </div>
          </div>

          {/* Standards Panel */}
          <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
            <h3 className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 mb-4 uppercase tracking-widest">Novakid TN Standards</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STANDARDS.map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-indigo-900/70 dark:text-indigo-300 font-semibold">
                  <div className="w-5 h-5 rounded-full bg-white dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  {rule}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Output */}
        <div className="flex flex-col gap-6">
          {report ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                  Standardized Result
                </h2>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    copied
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy TNs'}
                </button>
              </div>
              <ReportViewer report={report} onRerun={handleFix} />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
              <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-slate-400 text-center px-8">
                {loading ? (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full" />
                      <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="font-bold text-slate-600 dark:text-slate-300">Fixing Notes...</p>
                    <p className="text-xs text-slate-400">Applying TN Conventions</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mb-6">
                      <FileText className="w-10 h-10 text-indigo-200 dark:text-indigo-800" />
                    </div>
                    <p className="max-w-[280px] font-medium leading-relaxed text-sm">
                      Standardized TNs will appear here in slide blocks with numbered steps.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Version Footer */}
      <div className="text-center pb-2">
        <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">TN Standardization v0.1.0</span>
      </div>

      {showInfo && <TNInfoModal onClose={() => setShowInfo(false)} />}

      <UnifiedToolSettingsModal
        toolId="tn-standardizer"
        isOpen={showSettings}
        onClose={handleSettingsClose}
        defaultPrompt={additionalInstructions}
        lockedPromptDisplay={LOCKED_PROMPT}
        toolLabel="TN Standardizer"
      />
    </div>
  );
};
