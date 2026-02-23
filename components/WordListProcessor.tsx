
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Settings, X, Database, ShieldAlert, ClipboardList, History, Trash2 } from 'lucide-react';
import { parseCSV, generateCSV } from '../utils/csvHelper';
import { ToolSettingsModal } from './ToolSettingsModal';
import { useAuth } from '../context/AuthContext';

interface ProcessingHistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  stats: {
    rawTotal: number;
    internalDuplicates: number;
    refExcluded: number;
    final: number;
  };
}

export const WordListProcessor: React.FC = () => {
  const { isAdmin } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceHeaders, setReferenceHeaders] = useState<string[]>([]);
  const [referenceRows, setReferenceRows] = useState<string[][]>([]);
  const [referenceSelectedIndices, setReferenceSelectedIndices] = useState<Set<number>>(new Set());

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<ProcessingHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('wl_processor_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [processedList, setProcessedList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<{ 
    rawTotal: number; 
    internalDuplicates: number; 
    refExcluded: number; 
    final: number 
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!isCsv(selectedFile)) {
        setError('Please upload a valid CSV file.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setProcessedList([]);
      setStats(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsedData = parseCSV(text);
          if (parsedData.length > 0) {
            setHeaders(parsedData[0]);
            setRows(parsedData.slice(1));
            setSelectedIndices(new Set());
          } else {
            setError('The CSV file appears to be empty.');
          }
        } catch (err) {
          setError('Failed to parse CSV file.');
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleReferenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!isCsv(selectedFile)) return;
      setReferenceFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsedData = parseCSV(text);
          if (parsedData.length > 0) {
            setReferenceHeaders(parsedData[0]);
            setReferenceRows(parsedData.slice(1));
            setReferenceSelectedIndices(new Set()); 
          }
        } catch (err) {
          console.error("Error parsing reference CSV", err);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const isCsv = (file: File) => file.type === 'text/csv' || file.name.endsWith('.csv');

  const toggleColumn = (index: number, isReference: boolean) => {
    const targetSet = isReference ? referenceSelectedIndices : selectedIndices;
    const setFunction = isReference ? setReferenceSelectedIndices : setSelectedIndices;
    const newSet = new Set(targetSet);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setFunction(newSet);
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear the history logs?')) {
      setHistory([]);
      localStorage.removeItem('wl_processor_history');
    }
  };

  const processList = () => {
    if (selectedIndices.size === 0) {
      setError('Please select at least one column from the main file to process.');
      return;
    }
    if (referenceFile && referenceSelectedIndices.size === 0) {
      setError('You have uploaded a reference file but selected no columns. Please configure the reference settings or remove the file.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    setStats(null);
    setTimeout(() => {
      try {
        const blocklist = new Set<string>();
        if (referenceFile && referenceRows.length > 0) {
           referenceRows.forEach(row => {
             referenceSelectedIndices.forEach(colIndex => {
                if (row[colIndex]) {
                   const items = row[colIndex].split(',');
                   items.forEach(item => {
                     const cleaned = item.trim();
                     if (cleaned) blocklist.add(cleaned.toLowerCase());
                   });
                }
             });
           });
        }
        const seenInMain = new Set<string>();
        const validList: string[] = [];
        let rawTotal = 0;
        let internalDuplicates = 0;
        let refExcluded = 0;
        rows.forEach(row => {
          selectedIndices.forEach(colIndex => {
            if (row[colIndex]) {
              const items = row[colIndex].split(',');
              items.forEach(item => {
                const cleaned = item.trim();
                if (cleaned) {
                  rawTotal++;
                  const lower = cleaned.toLowerCase();
                  if (seenInMain.has(lower)) {
                    internalDuplicates++;
                  } else {
                    seenInMain.add(lower);
                    if (blocklist.has(lower)) {
                      refExcluded++;
                    } else {
                      validList.push(cleaned);
                    }
                  }
                }
              });
            }
          });
        });
        const sortedList = validList.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        setProcessedList(sortedList);
        const newStats = { rawTotal, internalDuplicates, refExcluded, final: sortedList.length };
        setStats(newStats);
        const historyItem: ProcessingHistoryItem = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          fileName: file?.name || 'Unknown',
          stats: newStats
        };
        const updatedHistory = [historyItem, ...history];
        setHistory(updatedHistory);
        localStorage.setItem('wl_processor_history', JSON.stringify(updatedHistory));
      } catch (err) {
        setError('An error occurred while processing the list.');
      } finally {
        setIsProcessing(false);
      }
    }, 500);
  };

  const handleDownload = () => {
    if (processedList.length === 0) return;
    const csvContent = generateCSV('Word', processedList);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `processed_wordlist_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto relative space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">LLM Word List Generator</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Upload a CSV, select columns, and generate a cleaned, de-duplicated vocabulary list.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReferenceModal(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
              referenceFile
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            {referenceFile ? 'Ref Active' : 'Ref List'}
            {referenceFile && <span className="flex h-2 w-2 rounded-full bg-indigo-500 ml-1"></span>}
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <History className="w-4 h-4" />
            History
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

      {/* Content Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6">

        <div className="mb-8">
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
              file ? 'border-indigo-300 dark:border-indigo-500/50 bg-slate-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
            {file ? (
              <div className="flex flex-col items-center">
                <FileText className="w-10 h-10 text-orange-500 mb-2" />
                <span className="font-medium text-slate-900 dark:text-slate-100">{file.name}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                <button className="mt-3 text-xs text-orange-600 dark:text-orange-400 underline" onClick={(e) => { e.stopPropagation(); setFile(null); setHeaders([]); setProcessedList([]); setStats(null); }}>Remove</button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-2" />
                <span className="font-medium text-slate-700 dark:text-slate-200">Click to upload Main CSV</span>
              </div>
            )}
          </div>
        </div>

        {headers.length > 0 && (
          <div className="mb-8 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Select Columns to Merge</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
              {headers.map((header, index) => (
                <label key={index} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedIndices.has(index) ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-500 dark:border-orange-500/50 ring-1 ring-orange-500' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                  <input type="checkbox" checked={selectedIndices.has(index)} onChange={() => toggleColumn(index, false)} className="mt-1 h-4 w-4 rounded text-orange-600" />
                  <span className={`text-sm ${selectedIndices.has(index) ? 'text-orange-900 dark:text-orange-300 font-medium' : 'text-slate-600 dark:text-slate-300'}`}>{header || `Col ${index + 1}`}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2 border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex justify-end items-center gap-4">
          <button
            onClick={processList}
            disabled={!file || selectedIndices.size === 0 || isProcessing}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
          >
            {isProcessing ? 'Processing...' : 'Process Word List'}
          </button>
        </div>
        </div>
      </div>

      {processedList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in-up">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-500" />List Generated</h2>
            <button onClick={handleDownload} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm shadow-indigo-500/20 uppercase tracking-widest"><Download className="w-4 h-4" />Download CSV</button>
          </div>
          {stats && (
            <div className="mx-6 mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 font-mono">
              Found {stats.rawTotal}, removed {stats.internalDuplicates} dupes, {stats.refExcluded} excluded. Final: {stats.final}.
            </div>
          )}
          <div className="p-6 max-h-64 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {processedList.slice(0, 50).map((word, i) => (
                <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">{word}</span>
              ))}
              {processedList.length > 50 && <span className="text-xs text-slate-500 italic">...and {processedList.length - 50} more</span>}
            </div>
          </div>
        </div>
      )}

      {showReferenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
               <div><h3 className="text-lg font-bold dark:text-white">Ref Database Settings</h3></div>
               <button onClick={() => setShowReferenceModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto bg-white dark:bg-slate-800">
              <div className="mb-6">
                 <div onClick={() => referenceInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${referenceFile ? 'border-teal-300 bg-teal-50' : 'border-slate-300'}`}>
                    <input type="file" ref={referenceInputRef} onChange={handleReferenceFileChange} accept=".csv" className="hidden" />
                    <Upload className="w-8 h-8 text-slate-400 mb-2 mx-auto" /><span className="text-sm font-medium">{referenceFile ? referenceFile.name : 'Click to upload Reference CSV'}</span>
                 </div>
              </div>
              {referenceHeaders.length > 0 && (
                <div><h4 className="text-sm font-semibold mb-3">Select Exclusion Columns</h4>
                   <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      {referenceHeaders.map((header, index) => (
                        <label key={index} className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${referenceSelectedIndices.has(index) ? 'bg-amber-50 border-amber-500' : 'bg-white dark:bg-slate-800 border-slate-200'}`}>
                          <input type="checkbox" checked={referenceSelectedIndices.has(index)} onChange={() => toggleColumn(index, true)} className="mt-1 h-3.5 w-3.5" />
                          <span className="text-xs font-medium">{header || `Col ${index + 1}`}</span>
                        </label>
                      ))}
                   </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex justify-end"><button onClick={() => setShowReferenceModal(false)} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">Done</button></div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900">
               <h3 className="text-lg font-bold dark:text-white">Output History</h3>
               <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              {history.length === 0 ? <div className="py-16 text-center text-slate-500">No history found.</div> : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">File Name</th><th className="px-6 py-3 text-right">Final Count</th></tr></thead>
                  <tbody className="divide-y">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">{new Date(item.timestamp).toLocaleDateString()}</td>
                        <td className="px-6 py-3 font-medium truncate max-w-[200px]">{item.fileName}</td>
                        <td className="px-6 py-3 text-right font-bold text-teal-600">{item.stats.final}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t flex justify-between items-center bg-slate-50 dark:bg-slate-900">
               <button onClick={clearHistory} disabled={history.length === 0} className="text-red-500 text-sm font-medium flex items-center gap-2 disabled:opacity-50"><Trash2 className="w-4 h-4" />Clear Logs</button>
               <button onClick={() => setShowHistoryModal(false)} className="px-4 py-2 bg-white dark:bg-slate-800 border rounded-lg text-sm font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
      <ToolSettingsModal toolId="word-cleaner" isOpen={showSettings} onClose={() => setShowSettings(false)} defaultPrompt="Follow word cleaning rules. De-duplicate and filter vocabulary items carefully." />
    </div>
  );
};
