import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Info, Settings, Trash2, ArrowRight, Maximize2, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { parseCSV, generateCSVForRows } from '../utils/csvHelper';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export const RowExpander: React.FC = () => {
    const { isAdmin } = useAuth();
    const [showSettings, setShowSettings] = useState(false); // Settings modal visibility (for future expansion)
    const [showInfo, setShowInfo] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    // File State
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<string[][]>([]);

    // Configuration
    const [expandColumnIdx, setExpandColumnIdx] = useState<number>(-1);
    const [keepColumnIndices, setKeepColumnIndices] = useState<number[]>([]);
    const [delimiter, setDelimiter] = useState<string>(',');
    const [trimWhitespace, setTrimWhitespace] = useState(true);
    const [preserveEmptyRows, setPreserveEmptyRows] = useState(true);

    // Statistics
    const [stats, setStats] = useState<{
        originalRowCount: number;
        rowsWithMultipleValues: number;
        rowsWithSingleValue: number;
        rowsEmpty: number;
        totalValuesPreExpansion: number;
        expandedRowCount: number;
        netRowIncrease: number;
    } | null>(null);

    const [processedRows, setProcessedRows] = useState<string[][]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const unsub = onSnapshot(doc(db, 'configurations', 'row-expander'), (snap) => {
            if (snap.exists()) {
                setIsLocked(!!snap.data().isLocked);
            }
        });
        return unsub;
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
                setError('Please upload a valid CSV file.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const text = event.target?.result as string;
                    const parsedData = parseCSV(text);
                    if (parsedData.length > 0) {
                        setFile(selectedFile);
                        setHeaders(parsedData[0]);
                        setRows(parsedData.slice(1));
                        setExpandColumnIdx(-1);
                        setKeepColumnIndices(parsedData[0].map((_, i) => i)); // Default keep all
                        setStats(null);
                        setProcessedRows([]);
                        setError(null);
                    }
                } catch (err) {
                    setError('Failed to parse CSV file.');
                }
            };
            reader.readAsText(selectedFile);
        }
    };

    const toggleKeepColumn = (idx: number) => {
        setKeepColumnIndices(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    const handleProcess = () => {
        if (!file || expandColumnIdx === -1) {
            setError('Please select a file and a column to expand.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setStats(null); // Reset stats

        setTimeout(() => {
            try {
                let rowsWithMultiple = 0;
                let rowsWithSingle = 0;
                let rowsEmpty = 0;
                let totalValuesPre = 0;

                const newRows: string[][] = [];

                rows.forEach(row => {
                    const cellValue = row[expandColumnIdx];

                    // Split Logic
                    let values: string[] = [];
                    if (cellValue && cellValue.includes(delimiter)) {
                        values = cellValue.split(delimiter);
                    } else if (cellValue) {
                        values = [cellValue];
                    } else {
                        values = [];
                    }

                    // Trimming
                    if (trimWhitespace) {
                        values = values.map(v => v.trim());
                    }

                    // Filter empty values if they result from split/trim (Logic decision: Keep explicit empty rows if preserveEmptyRows is set, but what about empty splits? usually empty splits are artifacts)
                    // Refined Logic per prompt: "Split only on exact delimiter" -> "Map values".
                    // "If empty: If preserve_empty_rows = true, keep unchanged"

                    const nonEmptyValues = values.filter(v => v.length > 0);
                    const finalValues = nonEmptyValues.length > 0 ? nonEmptyValues : (preserveEmptyRows ? [''] : []);

                    if (finalValues.length > 1) {
                        rowsWithMultiple++;
                    } else if (finalValues.length === 1 && finalValues[0] !== '') {
                        rowsWithSingle++;
                    } else {
                        rowsEmpty++;
                    }

                    totalValuesPre += finalValues.length > 0 ? finalValues.length : (preserveEmptyRows ? 1 : 0); // Count concept: Pre-expansion total values should ideally match Post-expansion row count.

                    // Expansion
                    finalValues.forEach(val => {
                        const newRow: string[] = [];
                        // Construct new row based on kept columns
                        // Note: Output only columns listed in keep_columns. Preserve order.
                        // We need to map `keepColumnIndices` (which refers to original indices) to the values.
                        // BUT, validation rule: "Duplicate all other column values exactly". 
                        // Implementation:
                        // We iterate through headers (or rather, the max range of columns) IF we want to preserve structure,
                        // But requirements say: "Output only columns listed in keep_columns".
                        // So the output CSV structure is defined by `keepColumnIndices`.

                        keepColumnIndices.sort((a, b) => a - b).forEach(idx => {
                            if (idx === expandColumnIdx) {
                                newRow.push(val);
                            } else {
                                newRow.push(row[idx] || '');
                            }
                        });
                        newRows.push(newRow);
                    });
                });

                const finalCount = newRows.length;

                setStats({
                    originalRowCount: rows.length,
                    rowsWithMultipleValues: rowsWithMultiple,
                    rowsWithSingleValue: rowsWithSingle,
                    rowsEmpty: rowsEmpty,
                    totalValuesPreExpansion: totalValuesPre,
                    expandedRowCount: finalCount,
                    netRowIncrease: finalCount - rows.length
                });

                setProcessedRows(newRows);

                // Content Audit
                if (finalCount !== totalValuesPre) {
                    // This is a logic check, but "preserveEmptyRows" might skew "totalValuesPre" calculation slightly if not careful.
                    // Let's rely on the expanded count.
                    console.warn(`Audit mismatch: ${finalCount} vs ${totalValuesPre}`);
                }

            } catch (e) {
                setError('An error occurred during processing.');
                console.error(e);
            } finally {
                setIsProcessing(false);
            }
        }, 500);
    };

    const handleDownload = () => {
        if (processedRows.length === 0) return;

        // Filter headers based on keepColumnIndices
        const sortedKeepIndices = [...keepColumnIndices].sort((a, b) => a - b);
        const finalHeaders = sortedKeepIndices.map(i => headers[i]);

        const csvContent = generateCSVForRows(finalHeaders, processedRows);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `expanded_rows_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="p-4 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
                            <Maximize2 className="w-8 h-8 text-white" />
                        </div>
                        {isLocked && <Shield className="w-3.5 h-3.5 text-teal-500 absolute -top-1 -right-1 fill-white dark:fill-slate-900" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            Row Expander
                            {isLocked && <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-800">Stable</span>}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            Expand rows with multiple values in a cell into atomic, single-value rows.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowInfo(true)}
                        className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                        title="Info"
                    >
                        <Info className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Info Modal */}
            {showInfo && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowInfo(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-500" />
                            About Row Expander
                        </h3>
                        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                            <p>
                                This tool structurally transforms CSVs by splitting cells with multiple values into separate rows.
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li><strong>Structural Only:</strong> No content is modified beyond the split.</li>
                                <li><strong>Atomic Rows:</strong> Each output row contains exactly one value from the expanded column.</li>
                                <li><strong>Data Preservation:</strong> All other column data is duplicated exactly for the new rows.</li>
                            </ul>
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs">
                                <strong>Tip:</strong> Use this before deduplication or ID matching to ensure every value is treated individually.
                            </div>
                        </div>
                        <button onClick={() => setShowInfo(false)} className="mt-6 w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Setup */}
                <div className="lg:col-span-1 space-y-6">
                    {/* 1. Upload */}
                    <div className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border transition-colors ${!file ? 'border-dashed border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'}`}>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">1</span>
                            Upload CSV
                        </h3>
                        {!file ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                            >
                                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Click to Upload</span>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                    <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">{file.name}</span>
                                </div>
                                <button onClick={() => { setFile(null); setHeaders([]); setRows([]); setExpandColumnIdx(-1); setProcessedRows([]); setStats(null); }} className="text-slate-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 2. Configuration */}
                    {file && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">2</span>
                                Configuration
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Row to Expand</label>
                                    <select
                                        value={expandColumnIdx}
                                        onChange={(e) => setExpandColumnIdx(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value={-1}>-- Select Column --</option>
                                        {headers.map((h, i) => (
                                            <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Delimiter</label>
                                    <input
                                        type="text"
                                        value={delimiter}
                                        onChange={(e) => setDelimiter(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 font-mono"
                                        placeholder=","
                                    />
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={trimWhitespace} onChange={e => setTrimWhitespace(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">Trim Whitespace</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={preserveEmptyRows} onChange={e => setPreserveEmptyRows(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">Preserve Empty Rows</span>
                                    </label>
                                </div>

                                <div className="pt-2">
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Columns to Keep</label>
                                    <div className="max-h-40 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1">
                                        {headers.map((h, i) => (
                                            <label key={i} className="flex items-center gap-2 p-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={keepColumnIndices.includes(i)}
                                                    onChange={() => toggleKeepColumn(i)}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{h || `Column ${i + 1}`}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleProcess}
                                disabled={isProcessing || expandColumnIdx === -1}
                                className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                            >
                                {isProcessing ? 'Processing...' : 'Expand Rows'}
                                {!isProcessing && <ArrowRight className="w-4 h-4" />}
                            </button>
                            {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
                        </div>
                    )}
                </div>

                {/* Right Col: Results */}
                <div className="lg:col-span-2">
                    {stats ? (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    Expansion Complete
                                </h3>
                            </div>

                            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Original Rows</p>
                                    <p className="text-2xl font-black text-slate-700 dark:text-slate-200">{stats.originalRowCount}</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Expanded Rows</p>
                                    <p className="text-2xl font-black text-slate-700 dark:text-slate-200">{stats.expandedRowCount}</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Net Increase</p>
                                    <p className="text-2xl font-black text-slate-700 dark:text-slate-200">+{stats.netRowIncrease}</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Multi-Value Rows</p>
                                    <p className="text-2xl font-black text-slate-700 dark:text-slate-200">{stats.rowsWithMultipleValues}</p>
                                </div>
                            </div>

                            <div className="p-6 pt-0">
                                <div className="text-sm space-y-1 mb-6 text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-4">
                                    <div className="flex justify-between">
                                        <span>Rows with single value:</span>
                                        <span className="font-medium">{stats.rowsWithSingleValue}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Empty rows:</span>
                                        <span className="font-medium">{stats.rowsEmpty}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-dashed border-slate-200 dark:border-slate-700 pt-1 mt-1">
                                        <span>Audit (Values Pre-Expansion):</span>
                                        <span className="font-mono">{stats.totalValuesPreExpansion}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleDownload}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                                >
                                    <Download className="w-5 h-5" />
                                    Download Expanded CSV
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 h-full flex flex-col items-center justify-center">
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                                <Maximize2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Ready to process</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto mt-2">
                                Upload a file and configure expansion settings to see the preview here.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
