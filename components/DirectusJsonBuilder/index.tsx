import React, { useState, useEffect } from 'react';
import { Download, Play, FileText, AlertCircle, Info, CheckCircle2, Braces, Settings, X, Lock, Unlock, Shield, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

const TOOL_ID = 'directus-json-builder';

type LeadStructure = 'lessons' | 'competencies' | null;

interface GenerationSummary {
    totalInputRows: number;
    uniquePairs: number;
    uniqueLeadEntities: number;
    filename: string;
}

export const DirectusJsonBuilder: React.FC = () => {
    const { isAdmin } = useAuth();
    const [csvData, setCsvData] = useState<any[] | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [lessonIdCol, setLessonIdCol] = useState('');
    const [competencyIdCol, setCompetencyIdCol] = useState('');
    const [leadStructure, setLeadStructure] = useState<LeadStructure>(null);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<GenerationSummary | null>(null);
    const [jsonOutput, setJsonOutput] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [lockLoading, setLockLoading] = useState(false);

    useEffect(() => {
        const fetchLock = async () => {
            try {
                const snap = await getDoc(doc(db, 'configurations', TOOL_ID));
                if (snap.exists()) setIsLocked(!!snap.data().isLocked);
            } catch { /* ignore */ }
        };
        fetchLock();
    }, []);

    const handleToggleLock = async () => {
        if (!isAdmin) return;
        if (isLocked && !confirm('Unlock this tool? This removes the Stable Mode restriction.')) return;
        const newLocked = !isLocked;
        setLockLoading(true);
        try {
            await setDoc(doc(db, 'configurations', TOOL_ID), {
                isLocked: newLocked,
                updatedAt: new Date().toISOString(),
                toolId: TOOL_ID
            });
            setIsLocked(newLocked);
        } catch { alert('Failed to update lock state.'); }
        setLockLoading(false);
    };

    const autoSuggest = (hdrs: string[]) => {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const lessonMatch = hdrs.find(h => ['lessonid', 'lesson_id', 'lesson'].includes(norm(h)));
        const compMatch = hdrs.find(h => ['competencyid', 'competency_id', 'compid'].includes(norm(h)));
        if (lessonMatch) setLessonIdCol(lessonMatch);
        if (compMatch) setCompetencyIdCol(compMatch);
    };

    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    setCsvData(results.data);
                    const hdrs = results.data.length > 0 ? Object.keys(results.data[0]) : [];
                    setHeaders(hdrs);
                    autoSuggest(hdrs);
                    setSummary(null);
                    setJsonOutput(null);
                    setError(null);
                }
            });
        };
        reader.readAsText(file);
    };

    const canGenerate = csvData && lessonIdCol && competencyIdCol && leadStructure;

    const handleGenerate = () => {
        if (!csvData || !lessonIdCol || !competencyIdCol || !leadStructure) return;

        setError(null);
        setSummary(null);
        setJsonOutput(null);

        // Filter valid rows (both IDs present)
        const validRows = csvData.filter(
            row => row[lessonIdCol]?.toString().trim() && row[competencyIdCol]?.toString().trim()
        );

        if (validRows.length === 0) {
            setError('No valid rows found. Ensure the selected columns are populated.');
            return;
        }

        // Deduplicate exact pairs
        const seen = new Set<string>();
        const uniqueRows = validRows.filter(row => {
            const key = `${row[lessonIdCol]?.toString().trim()}||${row[competencyIdCol]?.toString().trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        let output: any[];
        let filename: string;

        if (leadStructure === 'lessons') {
            // Group by lesson_id
            const lessonMap = new Map<string, string[]>();
            uniqueRows.forEach(row => {
                const lid = row[lessonIdCol].toString().trim();
                const cid = row[competencyIdCol].toString().trim();
                if (!lessonMap.has(lid)) lessonMap.set(lid, []);
                lessonMap.get(lid)!.push(cid);
            });

            output = Array.from(lessonMap.entries()).map(([lid, cids]) => ({
                id: lid,
                competencies: cids.map(cid => ({
                    competencies_id: { id: cid }
                }))
            }));
            filename = 'lessons_to_competencies_import.json';
        } else {
            // Group by competency_id
            const compMap = new Map<string, string[]>();
            uniqueRows.forEach(row => {
                const lid = row[lessonIdCol].toString().trim();
                const cid = row[competencyIdCol].toString().trim();
                if (!compMap.has(cid)) compMap.set(cid, []);
                compMap.get(cid)!.push(lid);
            });

            output = Array.from(compMap.entries()).map(([cid, lids]) => ({
                id: cid,
                lessons: lids.map(lid => ({
                    lessons_id: { id: lid }
                }))
            }));
            filename = 'competencies_to_lessons_import.json';
        }

        const jsonString = JSON.stringify(output, null, 2);
        setJsonOutput(jsonString);
        setSummary({
            totalInputRows: csvData.length,
            uniquePairs: uniqueRows.length,
            uniqueLeadEntities: output.length,
            filename
        });
    };

    const handleDownload = () => {
        if (!jsonOutput || !summary) return;
        const blob = new Blob([jsonOutput], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', summary.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-20">

            {/* Header */}
            <div className="flex justify-between items-center mb-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-violet-600 rounded-2xl shadow-lg shadow-violet-500/20">
                        <Braces className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            Directus JSON Builder
                            {isLocked && <span className="text-[10px] font-black uppercase tracking-widest text-teal-500 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" />Stable</span>}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            CSV → Directus Relation Import JSON
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowInfo(true)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-slate-800 transition-all"
                        title="About This Tool"
                    >
                        <Info className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-slate-800 transition-all"
                        title="Tool Settings"
                    >
                        <Settings className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Step 1: File Upload */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center">1</span>
                    Upload ID-Resolved CSV
                </h3>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center">
                    <input
                        type="file"
                        accept=".csv"
                        id="djb-upload"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                        }}
                    />
                    <label htmlFor="djb-upload" className="cursor-pointer">
                        <FileText className="w-10 h-10 text-violet-400 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                            {csvData ? (
                                <span className="text-green-600 dark:text-green-400 font-bold">✓ {csvData.length} rows loaded — click to replace</span>
                            ) : (
                                <>Click to upload CSV</>
                            )}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Must contain lesson_id and competency_id columns</p>
                    </label>
                </div>
            </div>

            {/* Step 2: Column Mapping */}
            {csvData && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6 animate-fade-in">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center">2</span>
                        Map Columns
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 tracking-wider">Lesson ID Column</label>
                            <select
                                value={lessonIdCol}
                                onChange={(e) => setLessonIdCol(e.target.value)}
                                className="w-full p-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none"
                            >
                                <option value="">Select column...</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5 tracking-wider">Competency ID Column</label>
                            <select
                                value={competencyIdCol}
                                onChange={(e) => setCompetencyIdCol(e.target.value)}
                                className="w-full p-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none"
                            >
                                <option value="">Select column...</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Lead Structure */}
            {csvData && lessonIdCol && competencyIdCol && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6 animate-fade-in">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center">3</span>
                        Choose Lead Structure
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {/* Lead by Lessons */}
                        <label className={`cursor-pointer flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${leadStructure === 'lessons' ? 'border-violet-500 bg-slate-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700'}`}>
                            <input
                                type="radio"
                                name="lead"
                                value="lessons"
                                checked={leadStructure === 'lessons'}
                                onChange={() => setLeadStructure('lessons')}
                                className="mt-0.5 accent-violet-500"
                            />
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Lead by Lessons</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Safer batching. Each lesson gets an array of linked competencies.</p>
                                <code className="text-[9px] text-violet-600 dark:text-violet-400 block mt-2 leading-tight font-mono">
                                    {"{ id: LESSON_ID, competencies: [...] }"}
                                </code>
                            </div>
                        </label>

                        {/* Lead by Competencies */}
                        <label className={`cursor-pointer flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${leadStructure === 'competencies' ? 'border-violet-500 bg-slate-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700'}`}>
                            <input
                                type="radio"
                                name="lead"
                                value="competencies"
                                checked={leadStructure === 'competencies'}
                                onChange={() => setLeadStructure('competencies')}
                                className="mt-0.5 accent-violet-500"
                            />
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Lead by Competencies</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Reverse relation. Each competency gets an array of linked lessons.</p>
                                <code className="text-[9px] text-violet-600 dark:text-violet-400 block mt-2 leading-tight font-mono">
                                    {"{ id: COMP_ID, lessons: [...] }"}
                                </code>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {/* Generate Button */}
            <div className="flex justify-center mb-8">
                <button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 ${!canGenerate
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/20 hover:-translate-y-1'
                        }`}
                >
                    <Play className="w-5 h-5 fill-current" />
                    Generate JSON
                </button>
            </div>

            {/* Guard warning */}
            {!canGenerate && csvData && (
                <div className="flex justify-center mb-4">
                    <p className="text-orange-600 dark:text-orange-400 font-bold text-sm bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {!lessonIdCol || !competencyIdCol
                            ? 'Map both columns before generating'
                            : 'Select a lead structure before generating'}
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 mb-6">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                </div>
            )}

            {/* Results Summary + Download */}
            {summary && jsonOutput && (
                <div className="space-y-6 animate-fade-in">
                    {/* Summary Stats */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            Generation Summary
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-center">
                                <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{summary.totalInputRows}</div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Input Rows</div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-center">
                                <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{summary.uniquePairs}</div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unique Pairs</div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                                <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{summary.uniqueLeadEntities}</div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    {leadStructure === 'lessons' ? 'Unique Lessons' : 'Unique Competencies'}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Braces className="w-4 h-4 text-violet-500" />
                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{summary.filename}</span>
                            </div>
                            <span className="text-[10px] font-bold uppercase text-slate-400">Ready to Download</span>
                        </div>
                    </div>

                    {/* JSON Preview */}
                    <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-400">JSON Preview (first 3 entries)</h4>
                        </div>
                        <pre className="text-[11px] text-violet-300 font-mono leading-relaxed overflow-auto max-h-56">
                            {JSON.stringify(JSON.parse(jsonOutput).slice(0, 3), null, 2)}
                            {JSON.parse(jsonOutput).length > 3 && '\n... and ' + (JSON.parse(jsonOutput).length - 3) + ' more'}
                        </pre>
                    </div>

                    {/* Download Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-1 active:scale-95 text-xs uppercase tracking-widest"
                        >
                            <Download className="w-5 h-5" />
                            Download {summary.filename}
                        </button>
                    </div>
                </div>
            )}
            {/* Info Modal */}
            {showInfo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Info className="w-5 h-5 text-violet-500" />
                                About This Tool
                            </h3>
                            <button onClick={() => setShowInfo(false)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-5 text-slate-600 dark:text-slate-300 leading-relaxed">
                            <p className="text-sm">This tool converts an ID-resolved CSV into a <strong>Directus import-ready JSON file</strong> for linking Lessons ↔ Competencies.</p>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">It supports two structures:</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li><strong>Lead by Lessons</strong> <span className="text-violet-500 font-semibold">(recommended for safer batching)</span></li>
                                    <li><strong>Lead by Competencies</strong> <span className="text-slate-500">(reverse relation structure)</span></li>
                                </ul>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">The tool:</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li>Groups rows by the selected lead column</li>
                                    <li>Removes duplicate lesson–competency pairs</li>
                                    <li>Ignores empty IDs</li>
                                    <li>Generates properly nested Directus relation JSON</li>
                                </ul>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800 dark:text-amber-300">This tool does <strong>not</strong> modify or validate IDs. It assumes the CSV already contains correct <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-[11px]">lesson_id</code> and <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-[11px]">competency_id</code> values.</p>
                            </div>
                            <p className="text-sm text-slate-500 italic">For best practice, use <strong className="text-slate-700 dark:text-slate-300">"Lead by Lessons"</strong> when batching imports to reduce overwrite risk.</p>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center">
                            <button onClick={() => setShowInfo(false)} className="px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-violet-500" />
                                Tool Settings
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            {/* Lock Status */}
                            <div className={`p-4 rounded-xl flex items-start gap-3 border ${isLocked ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
                                {isLocked ? <Lock className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" /> : <Unlock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />}
                                <div>
                                    <p className={`text-xs font-bold mb-1 ${isLocked ? 'text-teal-800 dark:text-teal-300' : 'text-amber-800 dark:text-amber-300'}`}>
                                        {isLocked ? 'STABLE MODE: Tool Logic Locked' : 'BETA MODE: Tool Unlocked'}
                                    </p>
                                    <p className={`text-[11px] leading-relaxed ${isLocked ? 'text-teal-700 dark:text-teal-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                        {isLocked
                                            ? 'This tool is certified as Stable. The logic is frozen to prevent regressions. Unlock to modify.'
                                            : 'This tool is in Beta. Admins can modify or lock the tool configuration below.'}
                                    </p>
                                </div>
                            </div>

                            {/* Module Logic Summary */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Module Logic</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Input', value: 'Single ID-resolved CSV with lesson_id and competency_id columns' },
                                        { label: 'Deduplication', value: 'Exact duplicate pairs (lesson_id + competency_id) are removed before grouping' },
                                        { label: 'Null Handling', value: 'Rows where either ID is empty are silently dropped' },
                                        { label: 'Lead by Lessons', value: 'Groups by lesson_id → competencies: [{ competencies_id: { id } }]' },
                                        { label: 'Lead by Competencies', value: 'Groups by competency_id → lessons: [{ lessons_id: { id } }]' },
                                        { label: 'Output Format', value: 'Pretty-printed JSON (indent = 2), UTF-8 safe' },
                                        { label: 'Normalization', value: 'None — IDs are used exactly as provided' },
                                    ].map(item => (
                                        <div key={item.label} className="flex gap-3 text-sm">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 min-w-[160px]">{item.label}</span>
                                            <span className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tool ID */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tool ID</span>
                                <code className="text-xs font-mono text-violet-600 dark:text-violet-400">{TOOL_ID}</code>
                            </div>

                            {!isAdmin && (
                                <div className="flex items-center gap-2 text-slate-400 text-xs">
                                    <Shield className="w-4 h-4" />
                                    <span>Lock controls require Admin access.</span>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            {isAdmin ? (
                                <button
                                    onClick={handleToggleLock}
                                    disabled={lockLoading}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isLocked ? 'bg-teal-500 hover:bg-teal-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'}`}
                                >
                                    {lockLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                    {isLocked ? 'Locked (Verified)' : 'Unlocked (Beta)'}
                                </button>
                            ) : <div />}
                            <button onClick={() => setShowSettings(false)} className="px-8 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-violet-500/20">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
