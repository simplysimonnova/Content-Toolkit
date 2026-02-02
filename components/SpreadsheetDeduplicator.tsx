
import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Trash2, ArrowRight, ShieldBan, FileCheck, Info } from 'lucide-react';
import { parseCSV, generateCSVForRows } from '../utils/csvHelper';

export const SpreadsheetDeduplicator: React.FC = () => {
  // Reference File (Blocklist)
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refHeaders, setRefHeaders] = useState<string[]>([]);
  const [refRows, setRefRows] = useState<string[][]>([]);
  const [refKeyIndex, setRefKeyIndex] = useState<number | null>(null);

  // Actionable File (Target)
  const [actFile, setActFile] = useState<File | null>(null);
  const [actHeaders, setActHeaders] = useState<string[]>([]);
  const [actRows, setActRows] = useState<string[][]>([]);
  const [actKeyIndex, setActKeyIndex] = useState<number | null>(null);

  // Settings
  const [removeInternalDuplicates, setRemoveInternalDuplicates] = useState(false);

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
    }
  } | null>(null);

  const refInputRef = useRef<HTMLInputElement>(null);
  const actInputRef = useRef<HTMLInputElement>(null);

  const isCsv = (file: File) => file.type === 'text/csv' || file.name.endsWith('.csv');

  const normalizeKey = (val: string | undefined) => {
    if (!val) return '';
    // Remove all whitespace (spaces, tabs) and quotes to handle "183 832" vs "183832"
    return val.toString().replace(/['"\s]/g, '').toLowerCase();
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
              setRefKeyIndex(null); // Reset column selection
            } else {
              setActFile(selectedFile);
              setActHeaders(parsedData[0]);
              setActRows(parsedData.slice(1));
              setActKeyIndex(null); // Reset column selection
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
    if (!actFile || actKeyIndex === null) return false;

    // 2. IF Reference File exists, must have Reference Column
    if (refFile && refKeyIndex === null) return false;

    // 3. Must be doing SOMETHING (either Ref Check OR Internal Check)
    const hasRefCheck = !!refFile;
    const hasInternalCheck = removeInternalDuplicates;

    return hasRefCheck || hasInternalCheck;
  };

  const handleProcess = () => {
    if (!actFile || actKeyIndex === null) {
      setError('Please configure the Actionable CSV.');
      return;
    }

    if (refFile && refKeyIndex === null) {
      setError('Please select a key column for the Reference CSV.');
      return;
    }

    if (!refFile && !removeInternalDuplicates) {
      setError('Please either upload a Reference CSV or enable "Remove internal duplicates".');
      return;
    }

    setIsProcessing(true);
    setError(null);

    setTimeout(() => {
      try {
        // 1. Build Lookup Set from Reference File (Normalized) - OPTIONAL
        const blocklist = new Set<string>();
        if (refFile && refKeyIndex !== null) {
          refRows.forEach(row => {
            const val = row[refKeyIndex];
            const normalized = normalizeKey(val);
            if (normalized) blocklist.add(normalized);
          });
        }

        // 2. Filter Actionable Rows
        const keptRows: string[][] = [];
        const seenInActionable = new Set<string>();
        
        let removedByRef = 0;
        let removedInternal = 0;

        actRows.forEach(row => {
          const rawVal = row[actKeyIndex];
          const key = normalizeKey(rawVal);
          
          if (!key) {
            // Keep empty rows for safety
            keptRows.push(row);
            return;
          }

          // Check Reference Match (if blocklist exists)
          if (blocklist.size > 0 && blocklist.has(key)) {
            removedByRef++;
            return; // Skip this row
          }

          // Check Internal Duplicate
          if (removeInternalDuplicates) {
            if (seenInActionable.has(key)) {
              removedInternal++;
              return; // Skip this row
            }
            seenInActionable.add(key);
          }

          keptRows.push(row);
        });

        setResult({
          processedRows: keptRows,
          stats: {
            originalCount: actRows.length,
            removedByRef,
            removedInternal,
            finalCount: keptRows.length,
            refSetSize: blocklist.size
          }
        });

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

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 transition-colors">
        <div className="mb-6">
           <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <ShieldBan className="w-6 h-6 text-orange-500" />
              Spreadsheet De-duplication
           </h2>
           <p className="text-slate-600 dark:text-slate-400 text-sm">
             Remove duplicates from your Actionable List by checking against a Reference List (optional) or by checking for duplicates within the file itself.
           </p>
           <div className="mt-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-2 rounded border border-blue-100 dark:border-blue-800 inline-flex items-center gap-2">
              <Info className="w-4 h-4"/>
              <span>Matching ignores spaces and casing (e.g., "19 607" matches "19607").</span>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
           
           {/* Arrow Icon */}
           <div className="hidden md:block absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400">
              <ArrowRight className="w-6 h-6" />
           </div>

           {/* 1. REFERENCE FILE */}
           <div className={`bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border flex flex-col h-full transition-colors ${!refFile ? 'border-dashed border-slate-300 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700'}`}>
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
                      <button onClick={() => { setRefFile(null); setRefHeaders([]); setRefRows([]); setRefKeyIndex(null); }} className="text-slate-400 hover:text-red-500">
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                   
                   <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Select Key Column to Match
                      </label>
                      <div className="max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                        {refHeaders.map((header, idx) => (
                           <label key={idx} className={`flex items-center gap-3 p-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 ${refKeyIndex === idx ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}>
                              <input 
                                type="radio" 
                                name="refCol" 
                                checked={refKeyIndex === idx} 
                                onChange={() => setRefKeyIndex(idx)}
                                className="text-orange-500 focus:ring-orange-500"
                              />
                              <span className={`text-sm ${refKeyIndex === idx ? 'font-medium text-orange-700 dark:text-orange-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                 {header || `Column ${idx+1}`}
                              </span>
                           </label>
                        ))}
                      </div>
                   </div>
                </div>
              )}
           </div>

           {/* 2. ACTIONABLE FILE */}
           <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full">
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
                      <button onClick={() => { setActFile(null); setActHeaders([]); setActRows([]); setActKeyIndex(null); setResult(null); }} className="text-slate-400 hover:text-red-500">
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                   
                   <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Select Key Column to Check
                      </label>
                      <div className="max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                        {actHeaders.map((header, idx) => (
                           <label key={idx} className={`flex items-center gap-3 p-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 ${actKeyIndex === idx ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}>
                              <input 
                                type="radio" 
                                name="actCol" 
                                checked={actKeyIndex === idx} 
                                onChange={() => setActKeyIndex(idx)}
                                className="text-teal-600 focus:ring-teal-500"
                              />
                              <span className={`text-sm ${actKeyIndex === idx ? 'font-medium text-teal-700 dark:text-teal-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                 {header || `Column ${idx+1}`}
                              </span>
                           </label>
                        ))}
                      </div>
                   </div>
                </div>
              )}
           </div>
        </div>
        
        {/* SETTINGS AREA */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
          <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <input 
              type="checkbox" 
              checked={removeInternalDuplicates}
              onChange={(e) => setRemoveInternalDuplicates(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
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
        <div className="mt-8 flex justify-end pt-6 border-t border-slate-100 dark:border-slate-700">
           <button
             onClick={handleProcess}
             disabled={isProcessing || !isConfigValid()}
             className="px-8 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
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
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-teal-200 dark:border-teal-500/30 bg-teal-50/30 dark:bg-teal-500/5 animate-fade-in-up transition-colors">
           <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {result.stats.refSetSize > 0 && (
                  <div className="p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-teal-100 dark:border-teal-900/30">
                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Reference Blocklist Size</div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{result.stats.refSetSize}</div>
                  </div>
                 )}
                 <div className="p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-teal-100 dark:border-teal-900/30">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Original Actionable Rows</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{result.stats.originalCount}</div>
                 </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-t border-teal-200 dark:border-teal-800/30 pt-6">
                 <div>
                    <h2 className="text-xl font-bold text-teal-900 dark:text-teal-400 flex items-center gap-2 mb-2">
                       <CheckCircle className="w-6 h-6" />
                       De-duplication Complete
                    </h2>
                    <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-300">
                       {result.stats.refSetSize > 0 && (
                          <li>Removed <strong className="text-red-600 dark:text-red-400">{result.stats.removedByRef}</strong> found in reference.</li>
                       )}
                       {removeInternalDuplicates && (
                         <li>Removed <strong className="text-red-600 dark:text-red-400">{result.stats.removedInternal}</strong> internal duplicates.</li>
                       )}
                       <li className="pt-1 mt-1 border-t border-slate-200 dark:border-slate-700">
                         Final row count: <strong>{result.stats.finalCount}</strong>
                       </li>
                    </ul>
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
    </div>
  );
};
