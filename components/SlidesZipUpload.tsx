import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Upload, FileText, AlertCircle, CheckCircle, Image, FileArchive, Trash2, Play, Loader2, ShieldCheck } from 'lucide-react';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { buildSnapshotFromZip } from '../services/lessonSnapshotAdapter';
import { runDraftQA, ENGINE_VERSION } from '../services/qaEngineV1';
import type { QARunV1 } from '../types/qa-v1';
import type { QAModule } from '../types/qa-v1';
import type { QALessonSnapshot } from '../types/qa-v1';

interface SlideData {
  index: number;
  slidesText: string;
  notesText: string;
  imageCount: number;
}

interface ParseResult {
  slides: SlideData[];
  totalWordCount: number;
  totalImageCount: number;
  sourceHash: string;
}

function extractTextContent(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function parseSlidesZip(file: File): Promise<ParseResult> {
  const sourceHash = await computeSHA256(file);
  const zip = await JSZip.loadAsync(file);

  const indexFile = zip.file('index.html');
  if (!indexFile) {
    throw new Error('Invalid Slides.com export — index.html not found in ZIP.');
  }

  const html = await indexFile.async('string');

  // Extract notes JSON block: "notes":{"slideId":"note text",...}
  let notesBySlideId: Record<string, string> = {};
  try {
    const notesMatch = html.match(/"notes":\{[\s\S]*?\}/);
    if (notesMatch) {
      const jsonString = notesMatch[0].replace(/^"notes":/, '');
      notesBySlideId = JSON.parse(jsonString);
    }
  } catch {
    // Notes JSON malformed — proceed with empty notes
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const sectionEls = Array.from(doc.querySelectorAll('section.present, section[data-id], .slides section'));
  const sections = sectionEls.length > 0
    ? sectionEls
    : Array.from(doc.querySelectorAll('section'));

  if (sections.length === 0) {
    throw new Error('No slide sections found in index.html. This may not be a valid Slides.com export.');
  }

  const slides: SlideData[] = sections.map((section, i) => {
    const slideId = section.getAttribute('data-id') || '';
    const notesText = notesBySlideId[slideId] || '';

    // Clone to avoid mutating the parsed DOM
    const clone = section.cloneNode(true) as HTMLElement;
    // Remove nested sections (Reveal.js vertical stacks)
    clone.querySelectorAll('section').forEach(el => el.remove());

    const slidesText = clone.textContent?.trim() ?? '';
    const imageCount = clone.querySelectorAll('img').length;

    return { index: i + 1, slidesText, notesText, imageCount };
  });

  const totalWordCount = slides.reduce((sum, s) => sum + countWords(s.slidesText) + countWords(s.notesText), 0);
  const totalImageCount = slides.reduce((sum, s) => sum + s.imageCount, 0);

  return { slides, totalWordCount, totalImageCount, sourceHash };
}

const MAX_FILE_SIZE_MB = 50;

export const SlidesZipUpload: React.FC = () => {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [snapshot, setSnapshot] = useState<QALessonSnapshot | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Module selector
  const [modules, setModules] = useState<QAModule[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [modulesLoading, setModulesLoading] = useState(false);

  // QA run state
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaResult, setQaResult] = useState<QARunV1 | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  useEffect(() => {
    setModulesLoading(true);
    getDocs(collection(db, 'qa_modules'))
      .then(snap => {
        const mods = snap.docs.map(d => ({ id: d.id, ...d.data() } as QAModule));
        setModules(mods);
        if (mods.length > 0) setSelectedModuleId(mods[0].id!);
      })
      .catch(() => {})
      .finally(() => setModulesLoading(false));
  }, []);

  const reset = () => {
    setFile(null);
    setError(null);
    setResult(null);
    setSnapshot(null);
    setLessonId(null);
    setQaResult(null);
    setQaError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setResult(null);

    if (!selected.name.endsWith('.zip') && selected.type !== 'application/zip' && selected.type !== 'application/x-zip-compressed') {
      setError('Invalid file type. Please upload a .zip file exported from Slides.com.');
      return;
    }

    const sizeMB = selected.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      setError(`File is too large (${sizeMB.toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setFile(selected);
    setIsParsing(true);

    try {
      const parsed = await parseSlidesZip(selected);
      setResult(parsed);

      // Build snapshot from parsed output
      const snap = buildSnapshotFromZip(
        { slides: parsed.slides.map(s => ({
          slideIndex: s.index,
          slidesText: s.slidesText,
          notesText: s.notesText,
          imageCount: s.imageCount,
        })) },
        { sourceHash: parsed.sourceHash }
      );
      setSnapshot(snap);
    } catch (err: any) {
      setError(err.message ?? 'Failed to parse ZIP file.');
      setFile(null);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunDraftQA = async () => {
    if (!snapshot || !user || !selectedModuleId || !file) return;
    setQaLoading(true);
    setQaError(null);
    setQaResult(null);

    try {
      // 1. Create qa_lessons document
      const lessonRef = await addDoc(collection(db, 'qa_lessons'), {
        title: file.name,
        selected_module_id: selectedModuleId,
        writer_id: user.uid,
        qa_version: ENGINE_VERSION,
        stage1_status: 'not_started',
        stage2_status: 'not_started',
        stage3_status: 'not_started',
        stage4_status: 'not_started',
        stage5_status: 'not_started',
        final_production_status: 'not_locked',
        final_academic_status: 'not_started',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      setLessonId(lessonRef.id);

      // 2. Run Stage 1 — engine handles all Firestore stage writes
      const run = await runDraftQA(lessonRef.id, snapshot.slides_text);
      setQaResult(run);
    } catch (err: any) {
      setQaError(err.message ?? 'QA run failed.');
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">

      {/* Upload Zone */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <FileArchive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">QA Engine V1 — ZIP Upload</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Upload a Slides.com ZIP export to extract content and run Stage 1 Draft QA.</p>
          </div>
          {(file || result) && (
            <button onClick={reset} className="ml-auto text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {!result && !isParsing && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
          >
            <Upload className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Click to upload Slides.com ZIP export</p>
            <p className="text-xs text-slate-400 mt-1">Max {MAX_FILE_SIZE_MB} MB · .zip only</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {isParsing && (
          <div className="flex flex-col items-center justify-center p-10 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Parsing ZIP…</p>
            <p className="text-xs text-slate-400 mt-1">{file?.name}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Upload Error</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Result Summary */}
      {result && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5 animate-fade-in">

          {/* Ready banner */}
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Ready for QA</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                {file?.name} — structure validated, content extracted.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Slides', value: result.slides.length, icon: <FileText className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Total Words', value: result.totalWordCount, icon: <FileText className="w-4 h-4" />, color: 'text-slate-700 dark:text-slate-200' },
              { label: 'Images', value: result.totalImageCount, icon: <Image className="w-4 h-4" />, color: 'text-violet-600 dark:text-violet-400' },
            ].map(k => (
              <div key={k.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{k.label}</p>
                <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Per-slide breakdown */}
          <div>
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Per-Slide Breakdown</p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {['Slide', 'Slide Text (words)', 'Notes (words)', 'Images'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-black uppercase text-slate-400 tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {result.slides.map(s => (
                    <tr key={s.index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 font-mono font-bold text-slate-500 dark:text-slate-400">{s.index}</td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{countWords(s.slidesText)}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{countWords(s.notesText)}</td>
                      <td className="px-4 py-2 text-violet-600 dark:text-violet-400">{s.imageCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Module selector + Run button */}
      {result && snapshot && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Stage 1 — Draft Academic QA</p>

          {/* Module selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">QA Module</label>
            {modulesLoading ? (
              <p className="text-xs text-slate-400">Loading modules…</p>
            ) : modules.length === 0 ? (
              <p className="text-xs text-red-500">No QA modules found in Firestore. An admin must create a module before QA can run.</p>
            ) : (
              <select
                value={selectedModuleId}
                onChange={e => setSelectedModuleId(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
              >
                {modules.map(m => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                ))}
              </select>
            )}
          </div>

          {lessonId && (
            <p className="text-xs text-slate-400 font-mono">Lesson ID: {lessonId}</p>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleRunDraftQA}
              disabled={!selectedModuleId || qaLoading || modules.length === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
            >
              {qaLoading ? (
                <><Loader2 className="animate-spin h-4 w-4" />Running Stage 1…</>
              ) : (
                <><ShieldCheck className="w-4 h-4" />Run Draft Academic QA</>
              )}
            </button>
          </div>

          {qaError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">QA Error</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{qaError}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QA Result */}
      {qaResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 ${qaResult.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'}`} />
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Stage 1 Result</p>
            <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold ${
              qaResult.status === 'pass'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
              {qaResult.status === 'pass' ? 'Cleared' : 'Revision Required'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Core', value: `${qaResult.core_score}/30` },
              { label: 'Module', value: `${qaResult.module_score}/20` },
              { label: 'Total', value: `${qaResult.total_score}/50` },
            ].map(k => (
              <div key={k.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{k.label}</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100">{k.value}</p>
              </div>
            ))}
          </div>

          {qaResult.triggers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Triggers</p>
              <div className="space-y-1">
                {qaResult.triggers.map((t, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
                    t.blocks_progression
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300'
                  }`}>
                    <span className="font-mono font-bold">{t.trigger_type}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-70">{t.severity}</span>
                    {t.blocks_progression && <span className="ml-auto text-[10px] font-bold uppercase">Blocks</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="mt-2">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300">Raw JSON</summary>
            <pre className="mt-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg p-3 overflow-auto max-h-64 text-slate-600 dark:text-slate-300">{JSON.stringify(qaResult, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
};
