// Dedup Normalization v1.0
// Composite key: can_do_statement + CEFR + skill
// Semantic matching (quotes removed in key only)
// Row content never mutated

import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Trash2, ArrowRight, ShieldBan, FileCheck, Info, Settings, Shield, X, ChevronDown, ChevronRight } from 'lucide-react';
import { parseCSV, generateCSVForRows } from '../utils/csvHelper';
import { useAuth } from '../context/AuthContext';
import { ToolSettingsModal } from './ToolSettingsModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { logToolUsage } from '../services/geminiService';
import { normalizeColumnName, normalizeText } from '../utils/textNormalization';

export const SpreadsheetDeduplicator: React.FC = () => {
  const { isAdmin } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Reference File (Blocklist)
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refHeaders, setRefHeaders] = useState<string[]>([]);

  const [refRows, setRefRows] = useState<string[][]>([]);
  const [refKeyIndices, setRefKeyIndices] = useState<number[]>([]);

  // Actionable File (Target)
  const [actFile, setActFile] = useState<File | null>(null);
  const [actHeaders, setActHeaders] = useState<string[]>([]);
  const [actRows, setActRows] = useState<string[][]>([]);
  const [actKeyIndices, setActKeyIndices] = useState<number[]>([]);

  // Settings
  const [removeInternalDuplicates, setRemoveInternalDuplicates] = useState(false);

  // Key Alignment: array of [refColumnIndex, actColumnIndex] pairs
  const [keyAlignment, setKeyAlignment] = useState<[number, number][]>([]);

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    processedRows: string[][];
    stats: {
      originalCount: number;
      removedByRef: number;
      removedInternal: number;
      finalCount: number;
      refSetSize: number;
      duplicateDetails?: { key: string; rows: number[] }[];
    }
  } | null>(null);

  const [showDuplicateDetails, setShowDuplicateDetails] = useState(false);

  const refInputRef = useRef<HTMLInputElement>(null);
  const actInputRef = useRef<HTMLInputElement>(null);

  const isCsv = (file: File) => file.type === 'text/csv' || file.name.endsWith('.csv');



  /**
   * Create a composite key from multiple column values
   * @param vals - Array of column values
   * @param columnNames - Optional array of column names for canonicalization
   * @returns Composite key string
   */
  const normalizeKey = (vals: (string | undefined)[], columnNames?: string[]): string => {
    if (!vals || vals.length === 0) return '';

    // Normalize each value individually (with optional column-specific canonicalization)
    const normalizedVals = vals.map((val, idx) => {
      const colName = columnNames && columnNames[idx];
      let normalized = normalizeText(val, colName);
      // Remove all double quotes for key generation ONLY
      return normalized.replace(/"/g, '');
    });

    // Join with pipe separator (preserves existing composite key logic)
    return normalizedVals.join('|');
  };

  // Helper functions for key alignment management
  const addKeyPart = () => {
    setKeyAlignment([...keyAlignment, [-1, -1]]); // -1 = not selected
  };

  const removeKeyPart = (index: number) => {
    setKeyAlignment(keyAlignment.filter((_, i) => i !== index));
  };

  const updateKeyPart = (index: number, refIdx: number, actIdx: number) => {
    const updated = [...keyAlignment];
    updated[index] = [refIdx, actIdx];
    setKeyAlignment(updated);
  };

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configurations', 'deduplicator'), (snap) => {
      if (snap.exists()) {
        setIsLocked(!!snap.data().isLocked);
      }
    });
    return unsub;
  }, []);

  const toggleColumnSelection = (index: number, type: 'ref' | 'act') => {
    if (type === 'ref') {
      setRefKeyIndices(prev =>
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
    } else {
      setActKeyIndices(prev =>
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
    }
  };



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ref' | 'act') => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!isCsv(selectedFile)) {
        setError('Please upload a valid CSV file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsedData = parseCSV(text);
          if (parsedData.length > 0) {
            if (type === 'ref') {
              setRefFile(selectedFile);
              setRefHeaders(parsedData[0]);
              setRefRows(parsedData.slice(1));
              setRefKeyIndices([]); // Reset column selection
            } else {
              setActFile(selectedFile);
              setActHeaders(parsedData[0]);
              setActRows(parsedData.slice(1));
              setActKeyIndices([]); // Reset column selection
              setResult(null); // Reset results
            }
            setError(null);
          }
        } catch (err) {
          setError(`Failed to parse ${type === 'ref' ? 'Reference' : 'Actionable'} CSV file.`);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const isConfigValid = () => {
    // 1. Must have Actionable File & Column
    if (!actFile || actKeyIndices.length === 0) return false;

    // 2. IF Reference File exists, must have Reference Column
    if (refFile && refKeyIndices.length === 0) return false;

    // 3. Must be doing SOMETHING (either Ref Check OR Internal Check)
    const hasRefCheck = !!refFile;
    const hasInternalCheck = removeInternalDuplicates;

    return hasRefCheck || hasInternalCheck;
  };

  const handleProcess = () => {
    // Stateless execution: all Sets and counters reset per run

    // Validation: Check if using alignment or traditional column selection
    const usingAlignment = keyAlignment.length > 0;

    if (!actFile) {
      setError('Please upload an Actionable CSV file.');
      return;
    }

    if (usingAlignment) {
      // Validate alignment mode
      const hasInvalidPair = keyAlignment.some(([refIdx, actIdx]) => {
        if (refFile && (refIdx < 0 || refIdx >= refHeaders.length)) return true;
        if (actIdx < 0 || actIdx >= actHeaders.length) return true;
        return false;
      });

      if (hasInvalidPair) {
        setError('Please complete all key alignment selections.');
        return;
      }

      // If using alignment with reference file, must have at least one pair
      if (refFile && keyAlignment.length === 0) {
        setError('Please define at least one key alignment or use column checkboxes.');
        return;
      }
    } else {
      // Validate traditional mode (fallback)
      if (actKeyIndices.length === 0) {
        setError('Please select key columns for the Actionable CSV or define key alignment.');
        return;
      }

      if (refFile && refKeyIndices.length === 0) {
        setError('Please select key columns for the Reference CSV or define key alignment.');
        return;
      }
    }

    // REQUIRED COLUMN VALIDATION
    let selectedActColumns: string[] = [];
    if (usingAlignment) {
      selectedActColumns = keyAlignment.map(([_, actIdx]) => actHeaders[actIdx]);
    } else {
      selectedActColumns = actKeyIndices.map(idx => actHeaders[idx]);
    }

    const normalizedSelectedCols = selectedActColumns.map(normalizeColumnName);
    const hasCanDo = normalizedSelectedCols.some(col => col.includes('candostatement') || col === 'cando');
    const hasCefr = normalizedSelectedCols.some(col => col.includes('cefr') || col === 'level');
    const hasSkill = normalizedSelectedCols.some(col => col.includes('skill'));

    if (!hasCanDo || !hasCefr || !hasSkill) {
      setError('Composite key must include can_do_statement, CEFR, and skill.');
      return;
    }

    if (!refFile && !removeInternalDuplicates) {
      setError('Please either upload a Reference CSV or enable "Remove internal duplicates".');
      return;
    }

    // Explicitly reset result/error state before processing
    setIsProcessing(true);
    setResult(null);
    setError(null);

    setTimeout(() => {
      try {
        // Determine if using alignment or traditional mode
        const usingAlignment = keyAlignment.length > 0;

        // 1. Build Lookup Set from Reference File (Normalized) - OPTIONAL
        // Ensure these variables are recreated inside the function body
        const blocklist = new Set<string>();

        if (refFile && (usingAlignment ? keyAlignment.length > 0 : refKeyIndices.length > 0)) {
          refRows.forEach(row => {
            let vals: (string | undefined)[];
            let colNames: string[];

            if (usingAlignment) {
              // Use alignment: extract values from reference columns only
              vals = keyAlignment.map(([refIdx, _]) => row[refIdx]);
              colNames = keyAlignment.map(([refIdx, _]) => refHeaders[refIdx]);
            } else {
              // Traditional mode: use refKeyIndices
              vals = refKeyIndices.map(idx => row[idx]);
              colNames = refKeyIndices.map(idx => refHeaders[idx]);
            }

            const normalized = normalizeKey(vals, colNames);
            if (normalized) blocklist.add(normalized);
          });
        }

        // 2. Filter Actionable Rows
        // Ensure strictly local scope for tracking sets
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
            // Use alignment: extract values from actionable columns only
            vals = keyAlignment.map(([_, actIdx]) => row[actIdx]);
            colNames = keyAlignment.map(([_, actIdx]) => actHeaders[actIdx]);
          } else {
            // Traditional mode: use actKeyIndices
            vals = actKeyIndices.map(idx => row[idx]);
            colNames = actKeyIndices.map(idx => actHeaders[idx]);
          }

          const key = normalizeKey(vals, colNames);
          const rowNum = idx + 1; // 1-based row number (excluding header)

          if (!key) {
            // Keep empty rows for safety
            keptRows.push(row);
            return;
          }

          // Track occurrences for every key found in actionable
          if (!allOccurrences.has(key)) {
            allOccurrences.set(key, []);
          }
          allOccurrences.get(key)!.push(rowNum);

          // Check Reference Match (if blocklist exists)
          if (blocklist.size > 0 && blocklist.has(key)) {
            removedByRef++;
            removedKeys.add(key);
            return; // Skip this row
          }

          // Check Internal Duplicate
          if (removeInternalDuplicates) {
            if (seenInActionable.has(key)) {
              removedInternal++;
              removedKeys.add(key);
              return; // Skip this row
            }
            seenInActionable.add(key);
          }

          keptRows.push(row);
        });

        // Build duplicate details and sort by first occurrence
        const duplicateDetails = Array.from(removedKeys)
          .map(k => ({ key: k, rows: allOccurrences.get(k) || [] }))
          .sort((a, b) => (a.rows[0] || 0) - (b.rows[0] || 0));

        setResult({
          processedRows: keptRows,
          stats: {
            originalCount: actRows.length,
            removedByRef,
            removedInternal,
            finalCount: keptRows.length,
            refSetSize: blocklist.size,
            duplicateDetails
          }
        });
        setShowDuplicateDetails(false); // Ensure collapsed on new result

        // Log usage (fire and forget)
        logToolUsage({ tool_id: 'deduplicator', tool_name: 'Deduplicator', status: 'success' });

      } catch (err) {
        setError("An error occurred during de-duplication.");
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }, 600);
  };

  const handleDownload = () => {
    if (!result) return;
    const csvContent = generateCSVForRows(actHeaders, result.processedRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `actionable_no_duplicates_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadDuplicates = () => {
    if (!result || !result.stats.duplicateDetails) return;

    // Determine headers based on selected key columns
    let keyHeaders: string[] = [];
    if (keyAlignment.length > 0) {
      keyHeaders = keyAlignment.map(([_, actIdx]) => actHeaders[actIdx]);
    } else {
      keyHeaders = actKeyIndices.map(idx => actHeaders[idx]);
    }

    const headers = [...keyHeaders, 'duplicate_row_numbers', 'duplicate_count'];

    // Build rows from duplicate details
    const duplicateRows = result.stats.duplicateDetails.map(detail => {
      const keyParts = detail.key.split('|');
      const rowNumbers = detail.rows.join(',');
      const count = (detail.rows.length - 1).toString();
      return [...keyParts, rowNumbers, count];
    });

    const csvContent = generateCSVForRows(headers, duplicateRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `removed_duplicates_audit_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <ShieldBan className="w-8 h-8 text-white" />
            </div>
            {isLocked && <Shield className="w-3.5 h-3.5 text-teal-500 absolute -top-1 -right-1 fill-white dark:fill-slate-900" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              Spreadsheet De-duplication
              {isLocked && <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-800">Stable</span>}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Remove duplicates against a Reference List or within the file itself.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(true)}
            className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
            title="What this tool does"
          >
            <Info className="w-5 h-5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">

          {/* Arrow Icon */}
          <div className="hidden md:block absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400">
            <ArrowRight className="w-6 h-6" />
          </div>

          {/* 1. REFERENCE FILE */}
          <div className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border flex flex-col h-full transition-colors ${!refFile ? 'border-dashed border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'}`}>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">1</span>
              Reference CSV (Optional)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 ml-8">Upload to block specific IDs/Values.</p>

            {!refFile ? (
              <div
                onClick={() => refInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Upload Reference CSV</span>
                <input type="file" ref={refInputRef} onChange={(e) => handleFileChange(e, 'ref')} accept=".csv" className="hidden" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">{refFile.name}</span>
                  </div>
                  <button onClick={() => { setRefFile(null); setRefHeaders([]); setRefRows([]); setRefKeyIndices([]); }} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Select Key Column to Match
                  </label>
                  <div className="max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    {refHeaders.map((header, idx) => {
                      const isSelected = refKeyIndices.includes(idx);
                      return (
                        <label key={idx} className={`flex items-center gap-3 p-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleColumnSelection(idx, 'ref')}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                          />
                          <span className={`text-sm ${isSelected ? 'font-medium text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>
                            {header || `Column ${idx + 1}`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. ACTIONABLE FILE */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">2</span>
              Actionable CSV (Target)
            </h3>

            {!actFile ? (
              <div
                onClick={() => actInputRef.current?.click()}
                className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Upload Actionable CSV</span>
                <input type="file" ref={actInputRef} onChange={(e) => handleFileChange(e, 'act')} accept=".csv" className="hidden" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileCheck className="w-5 h-5 text-teal-500 flex-shrink-0" />
                    <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">{actFile.name}</span>
                  </div>
                  <button onClick={() => { setActFile(null); setActHeaders([]); setActRows([]); setActKeyIndices([]); setResult(null); }} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Select Key Column to Check
                  </label>
                  <div className="max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    {actHeaders.map((header, idx) => {
                      const isSelected = actKeyIndices.includes(idx);
                      return (
                        <label key={idx} className={`flex items-center gap-3 p-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleColumnSelection(idx, 'act')}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                          />
                          <span className={`text-sm ${isSelected ? 'font-medium text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>
                            {header || `Column ${idx + 1}`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* KEY ALIGNMENT SECTION */}
        {refFile && actFile && (
          <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 dark:bg-slate-600 text-white text-xs font-bold">3</span>
                  Key Alignment (Optional)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-8">
                  Define which columns represent the same semantic concept across both files. Leave empty to use column checkboxes above.
                </p>
              </div>
            </div>

            {keyAlignment.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  No key alignments defined. Using column selections above.
                </p>
                <button
                  onClick={addKeyPart}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2 mx-auto"
                >
                  <span className="text-lg">+</span>
                  Add First Key Part
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {keyAlignment.map((pair, idx) => {
                  const [refIdx, actIdx] = pair;
                  return (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-200 dark:border-indigo-700 flex items-center gap-4">
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 min-w-[80px]">
                        Key Part {idx + 1}
                      </span>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Reference Column Dropdown */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Reference Column
                          </label>
                          <select
                            value={refIdx}
                            onChange={(e) => updateKeyPart(idx, parseInt(e.target.value), actIdx)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value={-1}>-- Select Column --</option>
                            {refHeaders.map((header, headerIdx) => (
                              <option key={headerIdx} value={headerIdx}>
                                {header || `Column ${headerIdx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Actionable Column Dropdown */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Actionable Column
                          </label>
                          <select
                            value={actIdx}
                            onChange={(e) => updateKeyPart(idx, refIdx, parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value={-1}>-- Select Column --</option>
                            {actHeaders.map((header, headerIdx) => (
                              <option key={headerIdx} value={headerIdx}>
                                {header || `Column ${headerIdx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeKeyPart(idx)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Remove this key part"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={addKeyPart}
                  className="w-full px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-lg">+</span>
                  Add Another Key Part
                </button>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS AREA */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
          <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <input
              type="checkbox"
              checked={removeInternalDuplicates}
              onChange={(e) => setRemoveInternalDuplicates(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Remove internal duplicates within the Actionable CSV</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Check this to remove duplicates found within the file itself, even if no Reference file is used.</span>
            </div>
          </label>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2 border border-red-100 dark:border-red-800/50 animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* ACTION AREA */}
        <div className="mt-8 flex justify-end pt-6 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleProcess}
            disabled={isProcessing || !isConfigValid()}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <ShieldBan className="w-5 h-5" />
            )}
            Remove Duplicates
          </button>
        </div>
      </div>

      {/* RESULT */}
      {result && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in-up">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.stats.refSetSize > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Reference Blocklist Size</div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{result.stats.refSetSize}</div>
                </div>
              )}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Original Actionable Rows</div>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{result.stats.originalCount}</div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-teal-500" />
                  De-duplication Complete
                </h2>

                {/* Arithmetic Breakdown */}
                <div className="bg-white/70 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 font-mono text-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Original actionable rows:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{result.stats.originalCount}</span>
                  </div>

                  {result.stats.refSetSize > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-red-600 dark:text-red-400">Rows removed (found in reference):</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">−{result.stats.removedByRef}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        Some competencies appeared multiple times in the actionable file. All matching rows were removed to prevent duplicate imports.
                      </p>
                    </div>
                  )}

                  {removeInternalDuplicates && result.stats.removedInternal > 0 && (
                    <div className={`${result.stats.refSetSize > 0 ? 'border-t border-slate-200 dark:border-slate-700 pt-2' : ''}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-orange-600 dark:text-orange-400">Rows removed (internal duplicates):</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">−{result.stats.removedInternal}</span>
                      </div>
                    </div>
                  )}

                  <div className="border-t-2 border-slate-300 dark:border-slate-600 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-teal-700 dark:text-teal-300">Rows safe to import:</span>
                      <span className="font-bold text-lg text-teal-700 dark:text-teal-300">{result.stats.finalCount}</span>
                    </div>
                  </div>
                </div>

                {/* Collapsible Duplicate Details */}
                {result.stats.duplicateDetails && result.stats.duplicateDetails.length > 0 && (
                  <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white/50 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 pr-3">
                      <button
                        onClick={() => setShowDuplicateDetails(!showDuplicateDetails)}
                        className="flex-1 flex items-center justify-between p-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {showDuplicateDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          View removed duplicates (optional)
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full">
                          {result.stats.duplicateDetails.length} items
                        </span>
                      </button>

                      <button
                        onClick={handleDownloadDuplicates}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm flex-shrink-0"
                        title="Download Duplicate List as CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download list (CSV)
                      </button>
                    </div>

                    {showDuplicateDetails && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto space-y-4">
                        {result.stats.duplicateDetails.map((detail, idx) => (
                          <div key={idx} className="text-xs space-y-1">
                            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                              {detail.key.split('|').join(' | ')}
                            </div>
                            <div className="text-slate-500 dark:text-slate-500 font-mono ml-3.5">
                              Rows: {detail.rows.join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium shadow-sm flex items-center gap-2 transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Download className="w-5 h-5" />
                Download Clean CSV
              </button>
            </div>
          </div>
        </div>
      )}

      <ToolSettingsModal
        toolId="deduplicator"
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        defaultPrompt={`// Core De-duplication Logic
// This tool processes CSV files to remove duplicates based on composite keys.

Key Normalization Rules (Unicode-Safe):
1. Multi-column composite keys are supported (select multiple columns via checkboxes)

2. Text normalization pipeline (applied to each column value):
   a) Unicode normalization (NFKD) - handles accents, ligatures, etc.
   b) Smart character conversion:
      - Smart quotes (", ", ', ') → standard quotes
      - En/em dashes (–, —) → hyphen (-)
      - Non-breaking spaces → regular spaces
      - Ellipsis (…) → three dots (...)
   c) Remove quotes and apostrophes
   d) Whitespace normalization:
      - Trim leading/trailing whitespace
      - Collapse multiple spaces to single space
      - Preserves spaces within text (important for sentences)
   e) Convert to lowercase
   f) Optional canonicalization for categorical columns (default: off)

3. Composite key creation:
   - Normalized values joined with pipe separator (|)
   - Example: ["Student can read", "A1"] → "student can read|a1"
   
Processing Flow:
1. Build blocklist from Reference CSV (if provided)
   - Extract values from selected reference columns
   - Normalize and store in Set for O(1) lookup
   
2. Filter Actionable CSV rows:
   - Extract values from selected actionable columns
   - Normalize to create composite key
   - Check against reference blocklist (if exists)
   - Check for internal duplicates (if enabled)
   - Keep first occurrence, remove subsequent matches

Output:
- Cleaned CSV with duplicates removed
- Statistics: original count, removed by reference, removed internally, final count

Backward Compatibility:
- Single-column dedup works exactly as before
- Reference-based and internal-only dedup unchanged
- Whitespace handling improved to support semantic keys`}
      />

      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                What this tool does
              </h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto font-sans">
              <div className="space-y-8">
                <section>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    This tool helps you safely prepare a spreadsheet before import by removing entries that would create duplicate competencies.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mt-3">
                    You choose which columns define “the same entry” (for example: Can-Do + CEFR + Skill). These columns form a composite key used to compare rows.
                  </p>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">How duplicates are handled</h4>
                  <ul className="list-disc list-outside space-y-2 text-slate-600 dark:text-slate-400 text-sm ml-4">
                    <li>If an entry already exists in the Reference file, all matching rows are removed from the Actionable file.</li>
                    <li>If the same entry appears multiple times within the Actionable file, those internal duplicates are also removed (optional).</li>
                  </ul>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mt-3 italic bg-slate-50 dark:bg-black/20 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    Matching is semantic — formatting differences (case, spacing, quotes, CEFR format) will not create separate entries.
                  </p>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">What the results mean</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <div className="text-slate-600 dark:text-slate-400 text-sm">
                        <span className="font-bold text-slate-900 dark:text-slate-200 block mb-0.5">Rows removed</span>
                        Entries that would create duplicates and are unsafe to import.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                      <div className="text-slate-600 dark:text-slate-400 text-sm">
                        <span className="font-bold text-slate-900 dark:text-slate-200 block mb-0.5">Rows safe to import</span>
                        Entries that do not exist in the Reference file and can be safely added.
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    The downloaded file contains only entries that are safe to import.
                  </p>
                </section>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setShowInfo(false)}
                className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
