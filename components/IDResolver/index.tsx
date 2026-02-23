import React, { useState } from 'react';
import { Settings, Info, Download, Play, Link2, AlertCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { resolveIDs } from './matcher';
import { ColumnMapping, MatchResult } from './types';
import Papa from 'papaparse';

export const IDResolver: React.FC = () => {
    const [expandedFile, setExpandedFile] = useState<any[] | null>(null);
    const [libraryFile, setLibraryFile] = useState<any[] | null>(null);
    const [lessonFile, setLessonFile] = useState<any[] | null>(null);

    const [expandedHeaders, setExpandedHeaders] = useState<string[]>([]);
    const [libraryHeaders, setLibraryHeaders] = useState<string[]>([]);
    const [lessonHeaders, setLessonHeaders] = useState<string[]>([]);

    const [mapping, setMapping] = useState<ColumnMapping>({
        can_do_column: '',
        cefr_column: '',
        skill_column: '',
        triad_column: '',
        library_id_column: '',
        library_can_do_column: '',
        library_cefr_column: '',
        library_skill_column: '',
        lesson_id_column: '',
        lesson_lul_column: ''
    });

    const [result, setResult] = useState<MatchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileUpload = (
        file: File,
        setData: (data: any[]) => void,
        setHeaders: (headers: string[]) => void
    ) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    setData(results.data);
                    if (results.data.length > 0) {
                        setHeaders(Object.keys(results.data[0]));
                    }
                }
            });
        };
        reader.readAsText(file);
    };

    const handleProcess = () => {
        if (!expandedFile || !libraryFile || !lessonFile) {
            setError('Please upload all three files');
            return;
        }

        // Validate mapping
        const requiredFields = Object.keys(mapping) as (keyof ColumnMapping)[];
        const missingFields = requiredFields.filter(field => !mapping[field]);

        if (missingFields.length > 0) {
            setError(`Please map all required columns: ${missingFields.join(', ')}`);
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const matchResult = resolveIDs(expandedFile, libraryFile, lessonFile, mapping);
            setResult(matchResult);

            // Check for errors
            const hasErrors =
                matchResult.stats.competency_unmatched > 0 ||
                matchResult.stats.competency_duplicate_matches > 0 ||
                matchResult.stats.lesson_unmatched > 0 ||
                matchResult.stats.lesson_duplicate_matches > 0;

            if (hasErrors) {
                setError('Matching errors detected. Please review the error report below.');
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred during processing');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!result || result.matched.length === 0) return;

        const csv = Papa.unparse(result.matched, {
            columns: ['lesson_id', 'competency_id', 'triad', 'can_do', 'cefr', 'skill']
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `id_resolved_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadErrors = () => {
        if (!result) return;

        const errorRows = [
            ...result.competency_unmatched.map(row => ({ ...row, error_type: 'competency_unmatched' })),
            ...result.competency_duplicate_matches.map(row => ({ ...row, error_type: 'competency_duplicate' })),
            ...result.lesson_unmatched.map(row => ({ ...row, error_type: 'lesson_unmatched' })),
            ...result.lesson_duplicate_matches.map(row => ({ ...row, error_type: 'lesson_duplicate' }))
        ];

        if (errorRows.length === 0) return;

        const csv = Papa.unparse(errorRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `id_resolver_errors_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const canProcess = expandedFile && libraryFile && lessonFile &&
        Object.values(mapping).every(v => v !== '');

    return (
        <div className="max-w-7xl mx-auto animate-fade-in pb-20">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                        <div className="p-3 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20">
                            <Link2 className="w-8 h-8 text-white" />
                        </div>
                        ID Resolver
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Deterministic competency + lesson ID matching
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowInfo(true)}
                        className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                        title="Tool Information"
                    >
                        <Info className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                        title="Column Mapping"
                    >
                        <Settings className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* File Uploads */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Expanded Rows */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        Expanded Rows
                    </h3>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, setExpandedFile, setExpandedHeaders);
                            }}
                            className="hidden"
                            id="expanded-upload"
                        />
                        <label htmlFor="expanded-upload" className="cursor-pointer">
                            <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                {expandedFile ? `✓ ${expandedFile.length} rows` : 'Click to upload'}
                            </p>
                        </label>
                    </div>
                </div>

                {/* Full Library */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-500" />
                        Full Library
                    </h3>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, setLibraryFile, setLibraryHeaders);
                            }}
                            className="hidden"
                            id="library-upload"
                        />
                        <label htmlFor="library-upload" className="cursor-pointer">
                            <FileText className="w-8 h-8 text-green-500 mx-auto mb-2" />
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                {libraryFile ? `✓ ${libraryFile.length} rows` : 'Click to upload'}
                            </p>
                        </label>
                    </div>
                </div>

                {/* Lessons */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-500" />
                        Lessons
                    </h3>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, setLessonFile, setLessonHeaders);
                            }}
                            className="hidden"
                            id="lesson-upload"
                        />
                        <label htmlFor="lesson-upload" className="cursor-pointer">
                            <FileText className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                {lessonFile ? `✓ ${lessonFile.length} rows` : 'Click to upload'}
                            </p>
                        </label>
                    </div>
                </div>
            </div>

            {/* Process Button */}
            <div className="flex justify-center mb-8">
                <button
                    onClick={handleProcess}
                    disabled={!canProcess || loading}
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 ${!canProcess || loading
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:-translate-y-1'
                        }`}
                >
                    {loading ? (
                        <>Processing...</>
                    ) : (
                        <>
                            <Play className="w-5 h-5 fill-current" />
                            Resolve IDs
                        </>
                    )}
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 mb-6">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            Processing Report
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-center">
                                <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{result.stats.total_rows}</div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Rows</div>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                                <div className="text-2xl font-black text-green-600 dark:text-green-400">{result.stats.competency_matched}</div>
                                <div className="text-[10px] uppercase font-bold text-green-400 tracking-wider">Comp Matched</div>
                            </div>
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center">
                                <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{result.stats.lesson_matched}</div>
                                <div className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Lesson Matched</div>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{result.stats.final_row_count}</div>
                                <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Final Rows</div>
                            </div>
                        </div>

                        {/* Error Stats */}
                        {(result.stats.competency_unmatched > 0 || result.stats.competency_duplicate_matches > 0 ||
                            result.stats.lesson_unmatched > 0 || result.stats.lesson_duplicate_matches > 0) && (
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {result.stats.competency_unmatched > 0 && (
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                                            <div className="text-2xl font-black text-red-600">{result.stats.competency_unmatched}</div>
                                            <div className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Comp Unmatched</div>
                                        </div>
                                    )}
                                    {result.stats.competency_duplicate_matches > 0 && (
                                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-center">
                                            <div className="text-2xl font-black text-orange-600">{result.stats.competency_duplicate_matches}</div>
                                            <div className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Comp Duplicates</div>
                                        </div>
                                    )}
                                    {result.stats.lesson_unmatched > 0 && (
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                                            <div className="text-2xl font-black text-red-600">{result.stats.lesson_unmatched}</div>
                                            <div className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Lesson Unmatched</div>
                                        </div>
                                    )}
                                    {result.stats.lesson_duplicate_matches > 0 && (
                                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-center">
                                            <div className="text-2xl font-black text-orange-600">{result.stats.lesson_duplicate_matches}</div>
                                            <div className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Lesson Duplicates</div>
                                        </div>
                                    )}
                                </div>
                            )}
                    </div>

                    {/* Download Buttons */}
                    <div className="flex justify-center gap-4">
                        {result.matched.length > 0 && (
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-lg"
                            >
                                <Download className="w-5 h-5" />
                                Download Resolved CSV
                            </button>
                        )}
                        {(result.competency_unmatched.length > 0 || result.lesson_unmatched.length > 0 ||
                            result.competency_duplicate_matches.length > 0 || result.lesson_duplicate_matches.length > 0) && (
                                <button
                                    onClick={handleDownloadErrors}
                                    className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg"
                                >
                                    <Download className="w-5 h-5" />
                                    Download Error Report
                                </button>
                            )}
                    </div>

                    {/* Error Details Section */}
                    {(result.competency_unmatched.length > 0 || result.competency_duplicate_matches.length > 0 ||
                        result.lesson_unmatched.length > 0 || result.lesson_duplicate_matches.length > 0) && (
                            <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-orange-200 dark:border-orange-800">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-orange-500" />
                                    Error Details
                                </h3>

                                {/* Unmatched Competencies */}
                                {result.competency_unmatched.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="font-bold text-sm text-orange-700 dark:text-orange-400 mb-3">
                                            Unmatched Competencies ({result.competency_unmatched.length})
                                        </h4>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {result.competency_unmatched.map((row, idx) => (
                                                <div key={idx} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {row[mapping.can_do_column]}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        <span className="font-semibold">CEFR:</span> {row[mapping.cefr_column]} |
                                                        <span className="font-semibold ml-2">Skill:</span> {row[mapping.skill_column]} |
                                                        <span className="font-semibold ml-2">Triad:</span> {row[mapping.triad_column]}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Duplicate Competencies */}
                                {result.competency_duplicate_matches.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="font-bold text-sm text-orange-700 dark:text-orange-400 mb-3">
                                            Duplicate Competency Matches ({result.competency_duplicate_matches.length})
                                        </h4>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {result.competency_duplicate_matches.map((row, idx) => (
                                                <div key={idx} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {row[mapping.can_do_column]}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        <span className="font-semibold">CEFR:</span> {row[mapping.cefr_column]} |
                                                        <span className="font-semibold ml-2">Skill:</span> {row[mapping.skill_column]}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Unmatched Lessons */}
                                {result.lesson_unmatched.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="font-bold text-sm text-orange-700 dark:text-orange-400 mb-3">
                                            Unmatched Lessons ({result.lesson_unmatched.length})
                                        </h4>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {result.lesson_unmatched.map((row, idx) => (
                                                <div key={idx} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {row[mapping.can_do_column]}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        <span className="font-semibold">Triad:</span> {row[mapping.triad_column]}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Duplicate Lessons */}
                                {result.lesson_duplicate_matches.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-sm text-orange-700 dark:text-orange-400 mb-3">
                                            Duplicate Lesson Matches ({result.lesson_duplicate_matches.length})
                                        </h4>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {result.lesson_duplicate_matches.map((row, idx) => (
                                                <div key={idx} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {row[mapping.can_do_column]}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        <span className="font-semibold">Triad:</span> {row[mapping.triad_column]}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                </div>
            )}

            {/* Info Modal */}
            {showInfo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Info className="w-5 h-5 text-blue-500" />
                                About ID Resolver
                            </h3>
                            <button
                                onClick={() => setShowInfo(false)}
                                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Purpose</h4>
                                <p className="text-sm">This tool performs <strong>deterministic relational matching</strong> to resolve competency_id and lesson_id using normalized composite keys and exact triad matching.</p>
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-2">How It Works</h4>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li><strong>Step 1:</strong> Match competencies using normalized composite key (can_do + CEFR + skill)</li>
                                    <li><strong>Step 2:</strong> Match lessons using exact triad comparison</li>
                                    <li><strong>Validation:</strong> Zero tolerance for unmatched or duplicate matches</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Guarantees</h4>
                                <ul className="list-disc pl-5 space-y-1 text-sm marker:text-blue-400">
                                    <li>No fuzzy logic</li>
                                    <li>No partial matching</li>
                                    <li>No silent failures</li>
                                    <li>Deterministic results</li>
                                </ul>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center">
                            <button
                                onClick={() => setShowInfo(false)}
                                className="px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                            >
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal (Column Mapping) */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-blue-500" />
                                Column Mapping
                            </h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            {/* Expanded Rows Mapping */}
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-3">Expanded Rows Columns</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Can Do</label>
                                        <select
                                            value={mapping.can_do_column}
                                            onChange={(e) => setMapping({ ...mapping, can_do_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {expandedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">CEFR</label>
                                        <select
                                            value={mapping.cefr_column}
                                            onChange={(e) => setMapping({ ...mapping, cefr_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {expandedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Skill</label>
                                        <select
                                            value={mapping.skill_column}
                                            onChange={(e) => setMapping({ ...mapping, skill_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {expandedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Triad</label>
                                        <select
                                            value={mapping.triad_column}
                                            onChange={(e) => setMapping({ ...mapping, triad_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {expandedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Library Mapping */}
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-3">Full Library Columns</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">ID</label>
                                        <select
                                            value={mapping.library_id_column}
                                            onChange={(e) => setMapping({ ...mapping, library_id_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {libraryHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Can Do</label>
                                        <select
                                            value={mapping.library_can_do_column}
                                            onChange={(e) => setMapping({ ...mapping, library_can_do_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {libraryHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">CEFR</label>
                                        <select
                                            value={mapping.library_cefr_column}
                                            onChange={(e) => setMapping({ ...mapping, library_cefr_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {libraryHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Skill</label>
                                        <select
                                            value={mapping.library_skill_column}
                                            onChange={(e) => setMapping({ ...mapping, library_skill_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {libraryHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Lessons Mapping */}
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-3">Lessons Columns</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">ID</label>
                                        <select
                                            value={mapping.lesson_id_column}
                                            onChange={(e) => setMapping({ ...mapping, lesson_id_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {lessonHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">LuL (Triad)</label>
                                        <select
                                            value={mapping.lesson_lul_column}
                                            onChange={(e) => setMapping({ ...mapping, lesson_lul_column: e.target.value })}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                                        >
                                            <option value="">Select column...</option>
                                            {lessonHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
                            >
                                Save Mapping
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
