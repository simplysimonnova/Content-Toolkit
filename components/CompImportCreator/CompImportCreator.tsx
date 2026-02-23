import React, { useState, useEffect } from 'react';
import { TableProperties, FileSpreadsheet, Play, Download, AlertCircle, CheckCircle, Info, Settings, X, Lock, Unlock, Shield, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateCompImport } from './ai';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

const TOOL_ID = 'comp-import-creator';

interface ProcessedItem {
    statement: string;
    skill: string;
    cefr: string;
}

export const CompImportCreator: React.FC = () => {
    const { isAdmin } = useAuth();
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedData, setProcessedData] = useState<ProcessedItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
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

    const handleProcess = async () => {
        if (!inputText.trim()) {
            setError('Please enter some text to process.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setProcessedData(null);

        try {
            const data = await generateCompImport(inputText);
            if (data && data.length > 0) {
                setProcessedData(data);
            } else {
                setError('No valid statements were identified in the output.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred during processing.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!processedData) return;

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(processedData);

        const wscols = [
            { wch: 60 },
            { wch: 15 },
            { wch: 10 },
        ];
        worksheet['!cols'] = wscols;

        XLSX.utils.book_append_sheet(workbook, worksheet, "Can Do Statements");

        const fileName = `CompImport_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;

        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in space-y-8">

            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                        <TableProperties className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            Competency Builder
                            {isLocked && <span className="text-[10px] font-black uppercase tracking-widest text-teal-500 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" />Stable</span>}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            Transform raw &ldquo;Student can&hellip;&rdquo; statements into structured, import-ready competencies using AI-assisted tagging.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowInfo(true)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all"
                        title="About This Tool"
                    >
                        <Info className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all"
                        title="Tool Settings"
                    >
                        <Settings className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Input Section */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col">
                        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                            Input Statements
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                            Paste your raw list of statements below. They can be messy, quoted, or grouped.
                        </p>

                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={`Example:\n"Student can identify basic colors."\nStudent can ask simple questions about daily routines.\n...`}
                            className="flex-1 w-full min-h-[400px] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none font-mono text-sm leading-relaxed"
                        />

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handleProcess}
                                disabled={isProcessing || !inputText.trim()}
                                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-5 h-5 fill-current" />
                                        <span>Process Statements</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-800/50 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Output Section */}
                <div className="space-y-4">
                    {processedData ? (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col animate-fade-in-up">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-teal-500" />
                                        Processing Complete
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Found {processedData.length} valid statements.
                                    </p>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
                                >
                                    <Download className="w-4 h-4" />
                                    Download Excel
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                <div className="overflow-x-auto h-full max-h-[500px] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-1/2">Statement</th>
                                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-1/4">Skill</th>
                                                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 w-1/4">CEFR</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {processedData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-indigo-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{row.statement}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                                                            {row.skill}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${['A1', 'A2'].includes(row.cefr)
                                                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-100 dark:border-green-800'
                                                            : ['B1', 'B2'].includes(row.cefr)
                                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-100 dark:border-blue-800'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                                            }`}>
                                                            {row.cefr}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-4 shadow-sm">
                                <FileSpreadsheet className="w-8 h-8 opacity-50" />
                            </div>
                            <p className="font-medium">Processed Output Will Appear Here</p>
                            <p className="text-xs mt-2 opacity-70 max-w-xs text-center">
                                Review the tagged data before downloading the Excel file.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Modal */}
            {showInfo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Info className="w-5 h-5 text-indigo-500" />
                                About This Tool
                            </h3>
                            <button onClick={() => setShowInfo(false)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-5 text-slate-600 dark:text-slate-300 leading-relaxed">
                            <p className="text-sm">The <strong>Competency Builder</strong> transforms raw &ldquo;Student can&hellip;&rdquo; statements into structured, import-ready competencies using AI-assisted parsing and tagging.</p>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">It:</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li>Splits messy input into one statement per row</li>
                                    <li>Assigns exactly one skill <span className="text-slate-500">(vocabulary, grammar, speaking, phonics)</span></li>
                                    <li>Assigns a single CEFR level <span className="text-slate-500">(A1–B2, conservative if borderline)</span></li>
                                    <li>Preserves original wording with minimal punctuation cleanup</li>
                                    <li>Outputs a Directus-ready <code className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded text-[11px]">.xlsx</code> file</li>
                                </ul>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Important Notes</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                    <li>This tool generates structured competency candidates.</li>
                                    <li>It does not modify or adapt existing competencies.</li>
                                    <li>Similar or existing competencies must be reviewed manually.</li>
                                    <li>The AI returns strict JSON only; the UI converts it into the final spreadsheet format.</li>
                                </ul>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800 dark:text-amber-300">This tool is an <strong>AI-assisted competency structuring tool</strong>, not a linking or validation engine.</p>
                            </div>
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
                                <Settings className="w-5 h-5 text-indigo-500" />
                                Tool Settings
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
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
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Module Logic</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Input', value: 'Raw text containing "Student can..." statements, pasted into the textarea' },
                                        { label: 'Processing', value: 'AI (Gemini Flash) parses and tags each statement with can_do, skill, and CEFR' },
                                        { label: 'Skills', value: 'Exactly one of: vocabulary, grammar, speaking, phonics' },
                                        { label: 'CEFR Levels', value: 'Assigned per statement: A1, A2, B1, B2, C1, C2' },
                                        { label: 'Deduplication', value: 'Internal deduplication and cross-check against the full library using can_do + CEFR + skill' },
                                        { label: 'Output', value: 'Excel (.xlsx) file ready for Directus import — only net-new competencies included' },
                                        { label: 'Normalization', value: 'Deterministic matching to prevent formatting-difference false positives' },
                                    ].map(item => (
                                        <div key={item.label} className="flex gap-3 text-sm">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 min-w-[140px]">{item.label}</span>
                                            <span className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tool ID</span>
                                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{TOOL_ID}</code>
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
                            <button onClick={() => setShowSettings(false)} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
