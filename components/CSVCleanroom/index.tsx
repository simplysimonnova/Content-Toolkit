import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Download, FileText, Settings, Trash2, AlertCircle, CheckCircle2, Filter, Columns, Key, BarChart3, FileDown, X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { generateCSVForRows } from '../../utils/csvHelper';
import { logToolUsage } from '../../services/geminiService';

interface NormalizationOptions {
  trimWhitespace: boolean;
  collapseWhitespace: boolean;
  lowercase: boolean;
  unicodeNormalize: boolean;
  replaceSmartQuotes: boolean;
  removeDoubleQuotes: boolean;
  stripPunctuation: boolean;
}

interface ProcessingStats {
  originalRowCount: number;
  rowsRemoved: number;
  rowsRemaining: number;
  uniqueKeyCount: number;
  duplicateGroupsCount: number;
  topDuplicates: Array<{ key: string; count: number }>;
}

export const CSVCleanroom: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  
  const [selectedKeyColumns, setSelectedKeyColumns] = useState<string[]>([]);
  const [normalization, setNormalization] = useState<NormalizationOptions>({
    trimWhitespace: false,
    collapseWhitespace: false,
    lowercase: false,
    unicodeNormalize: false,
    replaceSmartQuotes: false,
    removeDoubleQuotes: false,
    stripPunctuation: false,
  });
  
  const [keepStrategy, setKeepStrategy] = useState<'first' | 'last'>('first');
  const [removeEmptyKeys, setRemoveEmptyKeys] = useState(false);
  const [treatNullAsEmpty, setTreatNullAsEmpty] = useState(false);
  
  const [selectedOutputColumns, setSelectedOutputColumns] = useState<string[]>([]);
  const [removeEmptyRows, setRemoveEmptyRows] = useState(false);
  const [removeEmptyColumns, setRemoveEmptyColumns] = useState(false);
  
  const [processedRows, setProcessedRows] = useState<any[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<any[]>([]);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  
  const [showKeyBuilder, setShowKeyBuilder] = useState(false);
  const [showNormalization, setShowNormalization] = useState(false);
  const [showOutputConfig, setShowOutputConfig] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data as any[];
        const cols = result.meta.fields || [];
        
        setHeaders(cols);
        setRows(data);
        setPreviewRows(data.slice(0, 20));
        setSelectedKeyColumns([]);
        setSelectedOutputColumns(cols);
        setProcessedRows([]);
        setDuplicateRows([]);
        setStats(null);
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        alert('Failed to parse CSV file.');
      }
    });
  };

  const normalizeValue = (value: string, options: NormalizationOptions): string => {
    let result = value;
    
    if (options.trimWhitespace) {
      result = result.trim();
    }
    if (options.collapseWhitespace) {
      result = result.replace(/\s+/g, ' ');
    }
    if (options.lowercase) {
      result = result.toLowerCase();
    }
    if (options.unicodeNormalize) {
      result = result.normalize('NFKD');
    }
    if (options.replaceSmartQuotes) {
      result = result.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    }
    if (options.removeDoubleQuotes) {
      result = result.replace(/"/g, '');
    }
    if (options.stripPunctuation) {
      result = result.replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '');
    }
    
    return result;
  };

  const buildCompositeKey = (row: any, columns: string[], options: NormalizationOptions): string => {
    const values = columns.map(col => {
      let val = row[col] ?? '';
      if (treatNullAsEmpty && (val === null || val === undefined)) {
        val = '';
      }
      return normalizeValue(String(val), options);
    });
    return values.join('|');
  };

  const runDeduplication = async () => {
    if (selectedKeyColumns.length === 0) {
      alert('Please select at least one column for the composite key.');
      return;
    }

    const startTime = Date.now();
    const keyMap = new Map<string, any[]>();
    
    rows.forEach(row => {
      const key = buildCompositeKey(row, selectedKeyColumns, normalization);
      
      if (removeEmptyKeys && key.split('|').every(v => v === '')) {
        return;
      }
      
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(row);
    });

    const deduplicated: any[] = [];
    const duplicates: any[] = [];
    const duplicateKeyCounts: Map<string, number> = new Map();

    keyMap.forEach((group, key) => {
      if (group.length === 1) {
        deduplicated.push(group[0]);
      } else {
        const kept = keepStrategy === 'first' ? group[0] : group[group.length - 1];
        deduplicated.push(kept);
        duplicates.push(...group.slice(keepStrategy === 'first' ? 1 : 0, keepStrategy === 'first' ? undefined : -1));
        duplicateKeyCounts.set(key, group.length);
      }
    });

    const topDuplicates = Array.from(duplicateKeyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));

    setProcessedRows(deduplicated);
    setDuplicateRows(duplicates);
    setStats({
      originalRowCount: rows.length,
      rowsRemoved: duplicates.length,
      rowsRemaining: deduplicated.length,
      uniqueKeyCount: keyMap.size,
      duplicateGroupsCount: duplicateKeyCounts.size,
      topDuplicates,
    });

    await logToolUsage({
      tool_id: 'csv-cleanroom',
      tool_name: 'CSV Cleanroom',
      status: 'success',
      execution_time_ms: Date.now() - startTime,
      metadata: {
        rows_processed: rows.length,
        rows_removed: duplicates.length,
        key_columns: selectedKeyColumns.length,
      }
    });
  };

  const exportCleanedCSV = () => {
    if (processedRows.length === 0) return;
    
    let outputData = processedRows.map(row => {
      const filtered: any = {};
      selectedOutputColumns.forEach(col => {
        filtered[col] = row[col];
      });
      return filtered;
    });

    if (removeEmptyRows) {
      outputData = outputData.filter(row => 
        Object.values(row).some(v => v !== '' && v !== null && v !== undefined)
      );
    }

    const outputHeaders = selectedOutputColumns;
    const outputRows = outputData.map(row => 
      selectedOutputColumns.map(col => String(row[col] ?? ''))
    );

    const csv = generateCSVForRows(outputHeaders, outputRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace('.csv', '')}_cleaned.csv` || 'cleaned.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDuplicatesCSV = () => {
    if (duplicateRows.length === 0) return;
    
    const dupRows = duplicateRows.map(row => 
      headers.map(col => String(row[col] ?? ''))
    );
    
    const csv = generateCSVForRows(headers, dupRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace('.csv', '')}_duplicates.csv` || 'duplicates.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSummaryReport = () => {
    if (!stats) return;
    
    const reportHeaders = ['Metric', 'Value'];
    const reportRows = [
      ['Original Row Count', String(stats.originalRowCount)],
      ['Rows Removed', String(stats.rowsRemoved)],
      ['Rows Remaining', String(stats.rowsRemaining)],
      ['Unique Key Count', String(stats.uniqueKeyCount)],
      ['Duplicate Groups Count', String(stats.duplicateGroupsCount)],
      ['', ''],
      ['Top 10 Duplicate Keys', 'Frequency'],
      ...stats.topDuplicates.map(d => [d.key, String(d.count)])
    ];
    
    const csv = generateCSVForRows(reportHeaders, reportRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace('.csv', '')}_summary.csv` || 'summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setPreviewRows([]);
    setSelectedKeyColumns([]);
    setSelectedOutputColumns([]);
    setProcessedRows([]);
    setDuplicateRows([]);
    setStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleKeyColumn = (col: string) => {
    setSelectedKeyColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const toggleOutputColumn = (col: string) => {
    setSelectedOutputColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const activeNormalizationCount = Object.values(normalization).filter(Boolean).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <Filter className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white">CSV Cleanroom</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Generic CSV deduplication and cleaning utility</p>
            </div>
          </div>
          {file && (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>

        {!file ? (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 text-center">
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Upload CSV File</p>
            <p className="text-xs text-slate-400 mb-4">Accepts any CSV with headers</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4" />
              Choose File
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">File Loaded</p>
                <span className="text-xs font-mono text-slate-500">{rows.length} rows</span>
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{file.name}</p>
              <p className="text-xs text-slate-400 mt-1">{headers.length} columns detected</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Preview (First 20 Rows)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900">
                    <tr>
                      {headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        {headers.map(h => (
                          <td key={h} className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setShowKeyBuilder(!showKeyBuilder)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-indigo-500" />
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-800 dark:text-white">Composite Key Builder</p>
                    <p className="text-xs text-slate-400">
                      {selectedKeyColumns.length === 0 ? 'No columns selected' : `${selectedKeyColumns.length} column(s) selected`}
                    </p>
                  </div>
                </div>
                {showKeyBuilder ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              
              {showKeyBuilder && (
                <div className="p-4 border-t dark:border-slate-700 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {headers.map(col => (
                      <button
                        key={col}
                        onClick={() => toggleKeyColumn(col)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          selectedKeyColumns.includes(col)
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-500'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-transparent hover:border-slate-300'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                  
                  {selectedKeyColumns.length > 0 && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800">
                      <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">Key Preview</p>
                      <p className="text-xs font-mono text-indigo-700 dark:text-indigo-300">
                        {selectedKeyColumns.join(' | ')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setShowNormalization(!showNormalization)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-amber-500" />
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-800 dark:text-white">Normalization Controls</p>
                    <p className="text-xs text-slate-400">
                      {activeNormalizationCount === 0 ? 'All off (default)' : `${activeNormalizationCount} active`}
                    </p>
                  </div>
                </div>
                {showNormalization ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              
              {showNormalization && (
                <div className="p-4 border-t dark:border-slate-700 space-y-3">
                  {[
                    { key: 'trimWhitespace', label: 'Trim leading/trailing whitespace' },
                    { key: 'collapseWhitespace', label: 'Collapse internal whitespace' },
                    { key: 'lowercase', label: 'Convert to lowercase' },
                    { key: 'unicodeNormalize', label: 'Unicode normalization (NFKD)' },
                    { key: 'replaceSmartQuotes', label: 'Replace smart quotes with standard quotes' },
                    { key: 'removeDoubleQuotes', label: 'Remove double quotes' },
                    { key: 'stripPunctuation', label: 'Strip punctuation (ASCII only)' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={normalization[key as keyof NormalizationOptions]}
                        onChange={(e) => setNormalization(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-emerald-500" />
                <p className="text-sm font-black text-slate-800 dark:text-white">Deduplication Behaviour</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Keep Strategy</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setKeepStrategy('first')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        keepStrategy === 'first'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-transparent'
                      }`}
                    >
                      Keep First
                    </button>
                    <button
                      onClick={() => setKeepStrategy('last')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        keepStrategy === 'last'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-transparent'
                      }`}
                    >
                      Keep Last
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={removeEmptyKeys}
                      onChange={(e) => setRemoveEmptyKeys(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                      Remove rows with empty composite key
                    </span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={treatNullAsEmpty}
                      onChange={(e) => setTreatNullAsEmpty(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                      Treat null and empty as equivalent
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setShowOutputConfig(!showOutputConfig)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Columns className="w-5 h-5 text-purple-500" />
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-800 dark:text-white">Output Column Selection</p>
                    <p className="text-xs text-slate-400">
                      {selectedOutputColumns.length} of {headers.length} columns selected
                    </p>
                  </div>
                </div>
                {showOutputConfig ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              
              {showOutputConfig && (
                <div className="p-4 border-t dark:border-slate-700 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {headers.map(col => (
                      <button
                        key={col}
                        onClick={() => toggleOutputColumn(col)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          selectedOutputColumns.includes(col)
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-2 border-purple-500'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-transparent hover:border-slate-300'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                  
                  <div className="space-y-2 pt-3 border-t dark:border-slate-700">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={removeEmptyRows}
                        onChange={(e) => setRemoveEmptyRows(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                        Remove fully empty rows
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={runDeduplication}
              disabled={selectedKeyColumns.length === 0}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              <Filter className="w-5 h-5" />
              Run Deduplication
            </button>

            {stats && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                    <p className="text-sm font-black text-slate-800 dark:text-white">Processing Report</p>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Original Rows</p>
                      <p className="text-2xl font-black text-slate-700 dark:text-slate-200">{stats.originalRowCount}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 mb-1">Rows Removed</p>
                      <p className="text-2xl font-black text-red-700 dark:text-red-300">{stats.rowsRemoved}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Rows Remaining</p>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.rowsRemaining}</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">Unique Keys</p>
                      <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{stats.uniqueKeyCount}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Duplicate Groups</p>
                      <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{stats.duplicateGroupsCount}</p>
                    </div>
                  </div>

                  {stats.topDuplicates.length > 0 && (
                    <div className="mt-6">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Top 10 Duplicate Keys</p>
                      <div className="space-y-2">
                        {stats.topDuplicates.map((dup, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate flex-1">{dup.key}</span>
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400 ml-3">{dup.count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={exportCleanedCSV}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export Cleaned CSV
                  </button>
                  
                  <button
                    onClick={exportDuplicatesCSV}
                    disabled={duplicateRows.length === 0}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-bold transition-colors disabled:cursor-not-allowed"
                  >
                    <FileDown className="w-4 h-4" />
                    Export Duplicates
                  </button>
                  
                  <button
                    onClick={exportSummaryReport}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Export Summary
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
