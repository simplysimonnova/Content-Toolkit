
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Tag, X, Database, Play, Loader2, ListChecks, Hash, History, Trash2, Eye, RefreshCw } from 'lucide-react';
import { parseCSV } from '../../utils/csvHelper';
import { assignTopicsWithAI, TopicAssignmentResult } from './ai';

interface TopicReference {
  id: string;
  topic: string;
  canDo: string;
}

interface TopicHistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  topicFileName: string;
  stats: {
    total: number;
    newTopics: number;
    existingTopics: number;
  };
  results: TopicAssignmentResult[];
}

export const TopicAssigner: React.FC = () => {
  // --- Main File (Words) State ---
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // --- Topic File State ---
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicFile, setTopicFile] = useState<File | null>(null);
  const [topicHeaders, setTopicHeaders] = useState<string[]>([]);
  const [topicRows, setTopicRows] = useState<string[][]>([]);

  // Topic Column Mapping Indices
  const [topicColIndex, setTopicColIndex] = useState<number | null>(null);
  const [idColIndex, setIdColIndex] = useState<number | null>(null);
  const [canDoColIndex, setCanDoColIndex] = useState<number | null>(null);

  // --- Processing State ---
  const [results, setResults] = useState<TopicAssignmentResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);

  // --- History State ---
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<TopicHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('topic_assigner_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const topicInputRef = useRef<HTMLInputElement>(null);

  const isCsv = (file: File) => file.type === 'text/csv' || file.name.endsWith('.csv');

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isTopic: boolean) => {
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
            if (isTopic) {
              setTopicFile(selectedFile);
              setTopicHeaders(parsedData[0]);
              setTopicRows(parsedData.slice(1));
              // Reset columns
              setTopicColIndex(null);
              setIdColIndex(null);
              setCanDoColIndex(null);
            } else {
              setFile(selectedFile);
              setHeaders(parsedData[0]);
              setRows(parsedData.slice(1));
              setSelectedIndices(new Set());
              setResults([]); // Clear current results when new file loaded
              setError(null);
            }
          }
        } catch (err) {
          setError(`Failed to parse ${isTopic ? 'topic' : 'word'} CSV file.`);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const toggleWordColumn = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const saveToHistory = (data: TopicAssignmentResult[]) => {
    try {
      const newTopics = data.filter(r => r.status === 'New').length;
      const existingTopics = data.length - newTopics;

      const newItem: TopicHistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        fileName: file?.name || 'Unknown File',
        topicFileName: topicFile?.name || 'Unknown Topics',
        stats: {
          total: data.length,
          newTopics,
          existingTopics
        },
        results: data
      };

      const newHistory = [newItem, ...history];
      setHistory(newHistory);
      localStorage.setItem('topic_assigner_history', JSON.stringify(newHistory));
    } catch (e) {
      console.error("Storage limit reached", e);
      setError("Results generated successfully, but could not be saved to history (storage full).");
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('topic_assigner_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to delete all history? This cannot be undone.")) {
      setHistory([]);
      localStorage.removeItem('topic_assigner_history');
    }
  };

  const loadFromHistory = (item: TopicHistoryItem) => {
    setResults(item.results);
    setShowHistoryModal(false);
    // Optionally clear current file inputs to indicate we are viewing a snapshot
    setFile(null);
    setHeaders([]);
    setTopicFile(null);
    setError(null);
  };

  const handleProcess = async () => {
    if (!file || selectedIndices.size === 0) {
      setError('Please select columns from your Word list.');
      return;
    }
    if (!topicFile || topicColIndex === null) {
      setError('Please upload a Topic list and select at least the Topic Name column.');
      setShowTopicModal(true);
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: 100 });

    try {
      // 1. Prepare Structured Reference Data
      const referenceData: TopicReference[] = [];
      const seenIds = new Set<string>();

      topicRows.forEach((row, rIdx) => {
        // Essential: Topic Name
        const topicName = row[topicColIndex]?.trim();
        if (!topicName) return;

        // Optional: ID (if not selected, generate a temporary one based on index/name)
        let id = idColIndex !== null ? row[idColIndex]?.trim() : `REF_${rIdx}`;
        if (!id) id = `REF_${rIdx}`;

        // Optional: Can Do
        const canDo = canDoColIndex !== null ? row[canDoColIndex]?.trim() : "";

        // Deduplicate references based on ID (if provided) or Topic Name
        if (!seenIds.has(id)) {
          referenceData.push({ id, topic: topicName, canDo });
          seenIds.add(id);
        }
      });

      if (referenceData.length === 0) {
        throw new Error("No valid topics found in the selected columns.");
      }

      // 2. Extract Unique Words
      const words = new Set<string>();
      rows.forEach(row => {
        selectedIndices.forEach(colIndex => {
          if (row[colIndex]) {
            const items = row[colIndex].split(/[,;]/); // Split by common delimiters
            items.forEach(item => {
              const cleaned = item.trim();
              if (cleaned) words.add(cleaned);
            });
          }
        });
      });
      const uniqueWords = Array.from(words);

      if (uniqueWords.length === 0) {
        throw new Error("No words found in the selected columns.");
      }

      // 3. Call AI Service
      const assignedData = await assignTopicsWithAI(
        uniqueWords,
        referenceData,
        (current: number, total: number) => setProgress({ current, total })
      );

      // Sort by Status (New first), then Topic, then Word
      assignedData.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'New' ? -1 : 1;
        if (a.topic === b.topic) return a.word.localeCompare(b.word);
        return a.topic.localeCompare(b.topic);
      });

      setResults(assignedData);
      saveToHistory(assignedData);

    } catch (err: any) {
      setError(err.message || 'An error occurred during processing.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleDownload = () => {
    if (results.length === 0) return;
    // CSV generation with all columns
    let csvContent = "Word,Topic ID,Topic Name,Can Do Statement,Status\n";
    results.forEach(r => {
      const w = `"${r.word.replace(/"/g, '""')}"`;
      const id = `"${r.topicId.replace(/"/g, '""')}"`;
      const t = `"${r.topic.replace(/"/g, '""')}"`;
      const c = `"${r.canDo.replace(/"/g, '""')}"`;
      const s = r.status;
      csvContent += `${w},${id},${t},${c},${s}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `assigned_topics_${new Date().getTime()}.csv`);
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
            <Tag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">LLM Topic Assigner</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Map words to existing topics. New topics are created only if necessary.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTopicModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              topicFile
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            {topicFile ? 'Topic List Active' : 'Configure Topics'}
            {topicFile && <span className="flex h-2 w-2 rounded-full bg-indigo-500 ml-1"></span>}
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="View History"
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6">

        {/* MAIN FILE UPLOAD */}
        <div className="mb-8">
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
              file ? 'border-indigo-300 dark:border-indigo-500/50 bg-slate-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e, false)}
              accept=".csv"
              className="hidden"
            />

            {file ? (
              <div className="flex flex-col items-center">
                <FileText className="w-10 h-10 text-orange-500 mb-2" />
                <span className="font-medium text-slate-900 dark:text-slate-100">{file.name}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                <button
                  className="mt-3 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setHeaders([]);
                    setResults([]);
                  }}
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-2" />
                <span className="font-medium text-slate-700 dark:text-slate-200">Click to upload Word List CSV</span>
              </div>
            )}
          </div>
        </div>

        {/* MAIN COLUMN SELECTION */}
        {headers.length > 0 && (
          <div className="mb-8 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Select Word Columns
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
              {headers.map((header, index) => (
                <label
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedIndices.has(index)
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 dark:border-indigo-500/50 ring-1 ring-indigo-500 dark:ring-indigo-500/50'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-400'
              }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIndices.has(index)}
                    onChange={() => toggleWordColumn(index)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-500 text-indigo-600 focus:ring-indigo-600 bg-white dark:bg-slate-800"
                  />
                  <span className={`text-sm ${selectedIndices.has(index) ? 'text-indigo-900 dark:text-indigo-300 font-medium' : 'text-slate-600 dark:text-slate-300'}`}>
                    {header || `Column ${index + 1}`}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* PROGRESS BAR */}
        {isProcessing && progress && (
          <div className="mb-6 animate-fade-in">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Processing with AI...</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">This may take a minute for large lists.</p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2 border border-red-100 dark:border-red-800/50">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* ACTION BUTTON */}
        <div className="flex justify-end">
          <button
            onClick={handleProcess}
            disabled={!file || selectedIndices.size === 0 || isProcessing}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run Topic Assigner
              </>
            )}
          </button>
        </div>
        </div>
      </div>

      {/* RESULTS TABLE */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in-up">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-500" />
                Assignment Complete ({results.length})
              </h2>
              {!file && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                  <History className="w-3 h-3" />
                  Viewing saved result from history
                </p>
              )}
            </div>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm shadow-indigo-500/20 flex items-center gap-2 transition-colors uppercase tracking-widest"
            >
              <Download className="w-4 h-4" />
              Download Full CSV
            </button>
          </div>

          <div className="overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 w-32">Status</th>
                    <th className="px-4 py-3">Word</th>
                    <th className="px-4 py-3">Topic ID</th>
                    <th className="px-4 py-3">Topic Name</th>
                    <th className="px-4 py-3">Can Do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {results.map((item, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${item.status === 'New' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.status === 'Existing'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                          }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{item.word}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-xs">{item.topicId}</td>
                      <td className="px-4 py-2.5 text-teal-700 dark:text-teal-400">{item.topic}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 italic max-w-xs truncate" title={item.canDo}>{item.canDo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TOPIC SETTINGS MODAL */}
      {showTopicModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Map Topic Columns</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Identify columns from your reference file.</p>
              </div>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 bg-white dark:bg-slate-800">
              {/* File Upload Section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">1. Upload Reference Topic CSV</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${topicFile ? 'border-orange-300 dark:border-orange-500/50 bg-orange-50/50 dark:bg-orange-500/10' : 'border-slate-300 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  onClick={() => topicInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={topicInputRef}
                    onChange={(e) => handleFileChange(e, true)}
                    accept=".csv"
                    className="hidden"
                  />
                  {topicFile ? (
                    <div className="flex flex-col items-center">
                      <Database className="w-8 h-8 text-orange-600 dark:text-orange-400 mb-2" />
                      <span className="font-medium text-slate-900 dark:text-slate-100">{topicFile.name}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{(topicFile.size / 1024).toFixed(1)} KB</span>
                      <button
                        className="mt-2 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTopicFile(null);
                          setTopicHeaders([]);
                          setTopicRows([]);
                        }}
                      >
                        Remove File
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
                      <span className="font-medium text-slate-700 dark:text-slate-200">Click to upload Topics</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Column Mapping Section */}
              {topicHeaders.length > 0 && (
                <div className="space-y-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-orange-500" />
                    2. Map Data Columns
                  </h4>

                  {/* ID Selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                      <span>ID Column <span className="text-slate-400 dark:text-slate-500 font-normal">(Recommended)</span></span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 dark:text-slate-300">Unique Identifier</span>
                    </label>
                    <select
                      className="w-full border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      value={idColIndex === null ? '' : idColIndex}
                      onChange={(e) => setIdColIndex(e.target.value === '' ? null : Number(e.target.value))}
                    >
                      <option value="">-- No ID Column --</option>
                      {topicHeaders.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>

                  {/* Topic Name Selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Topic Name Column <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      value={topicColIndex === null ? '' : topicColIndex}
                      onChange={(e) => setTopicColIndex(e.target.value === '' ? null : Number(e.target.value))}
                    >
                      <option value="">-- Select Topic Name --</option>
                      {topicHeaders.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>

                  {/* Can Do Selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Can Do Statement Column <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <select
                      className="w-full border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      value={canDoColIndex === null ? '' : canDoColIndex}
                      onChange={(e) => setCanDoColIndex(e.target.value === '' ? null : Number(e.target.value))}
                    >
                      <option value="">-- No Can Do Column --</option>
                      {topicHeaders.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <button
                onClick={() => {
                  if (topicColIndex === null && topicHeaders.length > 0) {
                    alert("Please select the Topic Name column.");
                    return;
                  }
                  setShowTopicModal(false);
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 active:transform active:scale-95"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
                  <History className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Assignment History</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Restore or download previous topic assignments.</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-0 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-500 dark:text-slate-400">
                  <History className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                  <p>No history records found.</p>
                  <p className="text-sm">Run an assignment to save results here automatically.</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 w-32">Date</th>
                      <th className="px-6 py-3">Source File</th>
                      <th className="px-6 py-3">Topic Source</th>
                      <th className="px-4 py-3 text-right">Words</th>
                      <th className="px-4 py-3 text-right">New Topics</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(item.timestamp).toLocaleDateString()}
                          <span className="block text-xs opacity-60">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={item.fileName}>
                          {item.fileName}
                        </td>
                        <td className="px-6 py-3 text-slate-600 truncate max-w-[150px]" title={item.topicFileName}>
                          {item.topicFileName}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{item.stats.total}</td>
                        <td className="px-4 py-3 text-right">
                          {item.stats.newTopics > 0 ? (
                            <span className="inline-flex px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                              +{item.stats.newTopics}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => loadFromHistory(item)}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Load into view"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <button
                onClick={clearHistory}
                disabled={history.length === 0}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Clear All History
              </button>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
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
