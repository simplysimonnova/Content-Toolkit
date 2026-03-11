// Cloned from Deduplicator on 2026-03-03
// Intentionally excludes pipeline validation logic.
// Changes to Deduplicator matching logic must be manually mirrored here.

import React, { useState, useRef } from 'react';
import {
  Upload, FileText, Download, CheckCircle, AlertCircle, Trash2,
  ArrowRight, FileCheck, ChevronDown, ChevronRight, Sparkles,
} from 'lucide-react';
import { parseCSV, generateCSVForRows } from '../../utils/csvHelper';
import { normalizeText } from '../../utils/textNormalization';
import { logToolUsage } from '../../services/geminiService';

// ---------------------------------------------------------------------------
// Cloned matching engine — schema-agnostic, no pipeline validation
// ---------------------------------------------------------------------------

function buildCompositeKey(vals: (string | undefined)[], colNames?: string[]): string {
  if (!vals || vals.length === 0) return '';
  const normalized = vals.map((val, idx) => {
    const colName = colNames?.[idx];
    const n = normalizeText(val, colName);
    return n.replace(/"/g, '');
  });
  return normalized.join('|');
}

function buildBlocklist(
  rows: string[][],
  headers: string[],
  alignment: [number, number][],
  fallbackIndices: number[]
): Set<string> {
  const set = new Set<string>();
  const usingAlignment = alignment.length > 0;
  rows.forEach(row => {
    let vals: (string | undefined)[];
    let colNames: string[];
    if (usingAlignment) {
      vals = alignment.map(([refIdx]) => row[refIdx]);
      colNames = alignment.map(([refIdx]) => headers[refIdx]);
    } else {
      vals = fallbackIndices.map(idx => row[idx]);
      colNames = fallbackIndices.map(idx => headers[idx]);
    }
    const key = buildCompositeKey(vals, colNames);
    if (key) set.add(key);
  });
  return set;
}

interface MatchResult {
  processedRows: string[][];
  stats: {
    originalCount: number;
    removedByRef: number;
    removedInternal: number;
    finalCount: number;
    refSetSize: number;
    duplicateDetails: { key: string; rows: number[] }[];
  };
}

function runDeduplication(
  refRows: string[][],
  refHeaders: string[],
  actRows: string[][],
  actHeaders: string[],
  alignment: [number, number][],
  refFallbackIndices: number[],
  actFallbackIndices: number[],
  removeInternalDuplicates: boolean
): MatchResult {
  const usingAlignment = alignment.length > 0;
  const blocklist = buildBlocklist(refRows, refHeaders, alignment, refFallbackIndices);

  const keptRows: string[][] = [];
  const seenInActionable = new Set<string>();
  const allOccurrences = new Map<string, number[]>();
  const removedKeys = new Set<string>();
  let removedByRef = 0;
  let removedInternal = 0;

  actRows.forEach((row, idx) => {
    let vals: (string | undefined)[];
    let colNames: string[];
    if (usingAlignment) {
      vals = alignment.map(([, actIdx]) => row[actIdx]);
      colNames = alignment.map(([, actIdx]) => actHeaders[actIdx]);
    } else {
      vals = actFallbackIndices.map(i => row[i]);
      colNames = actFallbackIndices.map(i => actHeaders[i]);
    }
    const key = buildCompositeKey(vals, colNames);
    const rowNum = idx + 1;
    if (!key) { keptRows.push(row); return; }
    if (!allOccurrences.has(key)) allOccurrences.set(key, []);
    allOccurrences.get(key)!.push(rowNum);
    if (blocklist.size > 0 && blocklist.has(key)) {
      removedByRef++; removedKeys.add(key); return;
    }
    if (removeInternalDuplicates) {
      if (seenInActionable.has(key)) {
        removedInternal++; removedKeys.add(key); return;
      }
      seenInActionable.add(key);
    }
    keptRows.push(row);
  });

  const duplicateDetails = Array.from(removedKeys)
    .map(k => ({ key: k, rows: allOccurrences.get(k) || [] }))
    .sort((a, b) => (a.rows[0] || 0) - (b.rows[0] || 0));

  return {
    processedRows: keptRows,
    stats: { originalCount: actRows.length, removedByRef, removedInternal, finalCount: keptRows.length, refSetSize: blocklist.size, duplicateDetails },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CSVCleanroom: React.FC = () => {
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refHeaders, setRefHeaders] = useState<string[]>([]);
  const [refRows, setRefRows] = useState<string[][]>([]);
  const [refKeyIndices, setRefKeyIndices] = useState<number[]>([]);

  const [actFile, setActFile] = useState<File | null>(null);
  const [actHeaders, setActHeaders] = useState<string[]>([]);
  const [actRows, setActRows] = useState<string[][]>([]);
  const [actKeyIndices, setActKeyIndices] = useState<number[]>([]);

  const [keyAlignment, setKeyAlignment] = useState<[number, number][]>([]);
  const [removeInternalDuplicates, setRemoveInternalDuplicates] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [showDuplicateDetails, setShowDuplicateDetails] = useState(false);

  const refInputRef = useRef<HTMLInputElement>(null);
  const actInputRef = useRef<HTMLInputElement>(null);

  const isCsv = (f: File) => f.type === 'text/csv' || f.name.endsWith('.csv');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ref' | 'act') => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!isCsv(selectedFile)) { setError('Please upload a valid CSV file.'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length > 0) {
          if (type === 'ref') {
            setRefFile(selectedFile); setRefHeaders(parsed[0]); setRefRows(parsed.slice(1));
            setRefKeyIndices([]); setKeyAlignment([]);
          } else {
            setActFile(selectedFile); setActHeaders(parsed[0]); setActRows(parsed.slice(1));
            setActKeyIndices([]); setKeyAlignment([]); setResult(null);
          }
          setError(null);
        }
      } catch { setError(`Failed to parse ${type === 'ref' ? 'Reference' : 'Actionable'} CSV file.`); }
    };
    reader.readAsText(selectedFile);
    e.target.value = '';
  };

  const clearRef = () => { setRefFile(null); setRefHeaders([]); setRefRows([]); setRefKeyIndices([]); setKeyAlignment([]); setResult(null); setError(null); };
  const clearAct = () => { setActFile(null); setActHeaders([]); setActRows([]); setActKeyIndices([]); setKeyAlignment([]); setResult(null); setError(null); };

  const toggleCol = (idx: number, type: 'ref' | 'act') => {
    if (type === 'ref') setRefKeyIndices(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx]);
    else setActKeyIndices(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx]);
  };

  const addKeyPart = () => setKeyAlignment(p => [...p, [-1, -1]]);
  const removeKeyPart = (idx: number) => setKeyAlignment(p => p.filter((_, i) => i !== idx));
  const updateKeyPart = (idx: number, ri: number, ai: number) =>
    setKeyAlignment(p => { const u = [...p]; u[idx] = [ri, ai]; return u; });

  const isConfigValid = (): boolean => {
    if (!actFile) return false;
    const usingAlignment = keyAlignment.length > 0;
    if (usingAlignment) {
      const bad = keyAlignment.some(([ri, ai]) => (refFile && (ri < 0 || ri >= refHeaders.length)) || ai < 0 || ai >= actHeaders.length);
      if (bad) return false;
    } else {
      if (actKeyIndices.length === 0) return false;
      if (refFile && refKeyIndices.length === 0) return false;
    }
    return !!refFile || removeInternalDuplicates;
  };

  const handleProcess = () => {
    setError(null);
    if (!actFile) { setError('Please upload an Actionable CSV file.'); return; }
    const usingAlignment = keyAlignment.length > 0;
    if (usingAlignment) {
      const bad = keyAlignment.some(([ri, ai]) => (refFile && (ri < 0 || ri >= refHeaders.length)) || ai < 0 || ai >= actHeaders.length);
      if (bad) { setError('Please complete all key alignment column selections.'); return; }
    } else {
      if (actKeyIndices.length === 0) { setError('Please select at least one key column in the Actionable CSV.'); return; }
      if (refFile && refKeyIndices.length === 0) { setError('Please select at least one key column in the Reference CSV.'); return; }
    }
    if (!refFile && !removeInternalDuplicates) { setError('Please upload a Reference CSV or enable "Remove internal duplicates".'); return; }
    setIsProcessing(true); setResult(null);
    setTimeout(() => {
      try {
        const output = runDeduplication(refFile ? refRows : [], refHeaders, actRows, actHeaders, keyAlignment, refKeyIndices, actKeyIndices, removeInternalDuplicates);
        setResult(output); setShowDuplicateDetails(false);
        logToolUsage({ tool_id: 'csv-cleanroom', tool_name: 'CSV Cleanroom', status: 'success' });
      } catch (err) { setError('An error occurred during reference deduplication.'); console.error(err); }
      finally { setIsProcessing(false); }
    }, 400);
  };

  const handleDownloadClean = () => {
    if (!result) return;
    const csv = generateCSVForRows(actHeaders, result.processedRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.setAttribute('download', `cleanroom_output_${Date.now()}.csv`);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDownloadRemoved = () => {
    if (!result?.stats.duplicateDetails?.length) return;
    const usingAlignment = keyAlignment.length > 0;
    const keyHeaders = usingAlignment ? keyAlignment.map(([, ai]) => actHeaders[ai]) : actKeyIndices.map(i => actHeaders[i]);
    const headers = [...keyHeaders, 'removed_row_numbers', 'match_count'];
    const rows = result.stats.duplicateDetails.map(d => [...d.key.split('|'), d.rows.join(','), String(d.rows.length)]);
    const csv = generateCSVForRows(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.setAttribute('download', `cleanroom_removed_audit_${Date.now()}.csv`);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 mb-6">
        <div className="p-4 bg-violet-600 rounded-2xl shadow-lg shadow-violet-500/20">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">CSV Cleanroom</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Reference deduplication for any CSV schema — no fixed column requirements.</p>
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6 p-8">

        {/* File Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
          <div className="hidden md:flex absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400">
            <ArrowRight className="w-6 h-6" />
          </div>

          {/* 1. Reference CSV */}
          <div className={`p-6 rounded-2xl border flex flex-col h-full transition-colors ${!refFile ? 'border-dashed border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'}`}>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">1</span>
              Reference CSV <span className="text-xs font-normal text-slate-400">(Blocklist)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 ml-8">Rows matching this file will be removed from the Actionable file.</p>
            {!refFile ? (
              <div onClick={() => refInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Upload Reference CSV</span>
                <input ref={refInputRef} type="file" accept=".csv" onChange={e => handleFileChange(e, 'ref')} className="hidden" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">{refFile.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">{refRows.length} rows</span>
                  </div>
                  <button onClick={clearRef} className="text-slate-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Key Columns</label>
                <div className="max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {refHeaders.map((header, idx) => {
                    const isSel = refKeyIndices.includes(idx);
                    return (
                      <label key={idx} className={`flex items-center gap-3 p-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isSel ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleCol(idx, 'ref')} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                        <span className={`text-sm ${isSel ? 'font-medium text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-400'}`}>{header || `Column ${idx + 1}`}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Actionable CSV */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">2</span>
              Actionable CSV <span className="text-xs font-normal text-slate-400">(Target)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 ml-8">Matching rows will be removed from this file.</p>
            {!actFile ? (
              <div onClick={() => actInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Upload Actionable CSV</span>
                <input ref={actInputRef} type="file" accept=".csv" onChange={e => handleFileChange(e, 'act')} className="hidden" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileCheck className="w-5 h-5 text-teal-500 flex-shrink-0" />
                    <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">{actFile.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">{actRows.length} rows</span>
                  </div>
                  <button onClick={clearAct} className="text-slate-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Key Columns</label>
                <div className="max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {actHeaders.map((header, idx) => {
                    const isSel = actKeyIndices.includes(idx);
                    return (
                      <label key={idx} className={`flex items-center gap-3 p-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isSel ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleCol(idx, 'act')} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                        <span className={`text-sm ${isSel ? 'font-medium text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-400'}`}>{header || `Column ${idx + 1}`}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Key Alignment — shown when both files loaded */}
        {refFile && actFile && (
          <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 dark:bg-slate-600 text-white text-xs font-bold">3</span>
                Key Alignment <span className="text-xs font-normal text-slate-400 ml-1">(Optional)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-8">Map columns that represent the same concept across both files. Leave empty to use the checkboxes above.</p>
            </div>
            {keyAlignment.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">No alignment defined — using column checkboxes.</p>
                <button onClick={addKeyPart} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2 mx-auto">
                  <span className="text-base leading-none">+</span> Add Key Part
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {keyAlignment.map((pair, idx) => {
                  const [ri, ai] = pair;
                  return (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-violet-200 dark:border-violet-700/50 flex items-center gap-4">
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400 min-w-[80px]">Key Part {idx + 1}</span>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Reference Column</label>
                          <select value={ri} onChange={e => updateKeyPart(idx, parseInt(e.target.value), ai)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500">
                            <option value={-1}>-- Select Column --</option>
                            {refHeaders.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Actionable Column</label>
                          <select value={ai} onChange={e => updateKeyPart(idx, ri, parseInt(e.target.value))} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500">
                            <option value={-1}>-- Select Column --</option>
                            {actHeaders.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                          </select>
                        </div>
                      </div>
                      <button onClick={() => removeKeyPart(idx)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all flex-shrink-0" title="Remove key part"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  );
                })}
                <button onClick={addKeyPart} className="w-full px-4 py-2 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                  <span className="text-base leading-none">+</span> Add Another Key Part
                </button>
              </div>
            )}
          </div>
        )}

        {/* Options */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700">
          <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <input type="checkbox" checked={removeInternalDuplicates} onChange={e => setRemoveInternalDuplicates(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Remove internal duplicates within the Actionable CSV</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Also deduplicate rows within the Actionable file itself, using the same key columns.</p>
            </div>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-5 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2 border border-red-100 dark:border-red-800/50 animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Action */}
        <div className="mt-8 flex justify-end pt-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={handleProcess} disabled={isProcessing || !isConfigValid()} className="px-8 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-violet-500/20 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest">
            {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Run Cleanroom
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in-up">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Original Rows', value: result.stats.originalCount, color: 'text-slate-700 dark:text-slate-200' },
                { label: 'Removed by Ref', value: result.stats.removedByRef, color: result.stats.removedByRef > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400' },
                { label: 'Internal Dupes', value: result.stats.removedInternal, color: result.stats.removedInternal > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400' },
                { label: 'Clean Rows', value: result.stats.finalCount, color: 'text-teal-600 dark:text-teal-400' },
              ].map(k => (
                <div key={k.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{k.label}</p>
                  <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex-1 w-full">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-teal-500" /> Cleanroom Complete
                </h2>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 font-mono text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">Original actionable rows:</span><span className="font-semibold text-slate-800 dark:text-slate-200">{result.stats.originalCount}</span></div>
                  {result.stats.refSetSize > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                      <div className="flex justify-between"><span className="text-red-600 dark:text-red-400">Removed (matched reference):</span><span className="font-semibold text-red-600 dark:text-red-400">−{result.stats.removedByRef}</span></div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Reference blocklist size: {result.stats.refSetSize} unique keys</p>
                    </div>
                  )}
                  {result.stats.removedInternal > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                      <div className="flex justify-between"><span className="text-orange-600 dark:text-orange-400">Removed (internal duplicates):</span><span className="font-semibold text-orange-600 dark:text-orange-400">−{result.stats.removedInternal}</span></div>
                    </div>
                  )}
                  <div className="border-t-2 border-slate-300 dark:border-slate-600 pt-2">
                    <div className="flex justify-between"><span className="font-semibold text-teal-700 dark:text-teal-300">Clean rows remaining:</span><span className="font-bold text-lg text-teal-700 dark:text-teal-300">{result.stats.finalCount}</span></div>
                  </div>
                </div>

                {result.stats.duplicateDetails.length > 0 && (
                  <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 pr-3">
                      <button onClick={() => setShowDuplicateDetails(v => !v)} className="flex-1 flex items-center justify-between p-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="flex items-center gap-2">
                          {showDuplicateDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          View removed keys
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full">{result.stats.duplicateDetails.length} keys</span>
                      </button>
                      <button onClick={handleDownloadRemoved} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm">
                        <Download className="w-3.5 h-3.5" /> Download audit
                      </button>
                    </div>
                    {showDuplicateDetails && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-700 max-h-56 overflow-y-auto space-y-3">
                        {result.stats.duplicateDetails.map((d, idx) => (
                          <div key={idx} className="text-xs space-y-0.5">
                            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />{d.key.split('|').join(' | ')}
                            </div>
                            <div className="text-slate-500 dark:text-slate-500 font-mono ml-3.5">Rows: {d.rows.join(', ')}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={handleDownloadClean} className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium shadow-sm flex items-center gap-2 transition-transform hover:-translate-y-0.5 active:translate-y-0 flex-shrink-0">
                <Download className="w-5 h-5" /> Download Clean CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
