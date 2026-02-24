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

        const requiredFields = Object.keys(mapping) as (keyof ColumnMapping)[];
        const missingFields = requiredFields.filter(field => !mapping[field]);

        if (missingFields.length > 0) {
            setError(`Please map all required columns before resolving IDs.`);
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const matchResult = resolveIDs(expandedFile, libraryFile, lessonFile, mapping);
            setResult(matchResult);

            const { competency_misses, skill_conflicts, lesson_misses } = matchResult.stats;
            if (competency_misses > 0 || skill_conflicts > 0 || lesson_misses > 0) {
                const parts = [];
                if (competency_misses > 0) parts.push(`${competency_misses} comp miss${competency_misses > 1 ? 'es' : ''}`);
                if (skill_conflicts > 0) parts.push(`${skill_conflicts} skill conflict${skill_conflicts > 1 ? 's' : ''}`);
                if (lesson_misses > 0) parts.push(`${lesson_misses} lesson miss${lesson_misses > 1 ? 'es' : ''}`);
                setError(`Completed with ${parts.join(', ')}. Review summary below.`);
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

        const csv = Papa.unparse(result.matched);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `id_resolved_v2_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const autoSuggestMapping = (headers: string[], type: 'expanded' | 'library' | 'lesson') => {
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const newMapping = { ...mapping };

        const suggestions: Record<string, string[]> = {
            can_do_column: ['cando', 'can-do', 'statement', 'cando-statement', 'can-do-statement'],
            cefr_column: ['cefr', 'level', 'cefrlevel'],
            skill_column: ['skill', 'category'],
            triad_column: ['triad', 'lul', 'lessonid', 'lesson'],
            library_id_column: ['competencyid', 'id', 'compid'],
            library_can_do_column: ['cando', 'can-do', 'statement'],
            library_cefr_column: ['cefr', 'level'],
            library_skill_column: ['skill', 'category'],
            lesson_id_column: ['lessonid', 'id'],
            lesson_lul_column: ['lul', 'triad', 'lesson']
        };

        const relevantKeys = type === 'expanded'
            ? ['can_do_column', 'cefr_column', 'skill_column', 'triad_column']
            : type === 'library'
                ? ['library_id_column', 'library_can_do_column', 'library_cefr_column', 'library_skill_column']
                : ['lesson_id_column', 'lesson_lul_column'];

        relevantKeys.forEach(key => {
            const matches = suggestions[key];
            const found = headers.find(h => matches.includes(normalize(h)));
            if (found) (newMapping as any)[key] = found;
        });

        setMapping(newMapping);
    };

    const handleDownloadErrors = () => {
        if (!result) return;
        const errorRows = result.matched.filter(row => !row.competency_match_found || !row.lesson_match_found);
        if (errorRows.length === 0) return;

        const csv = Papa.unparse(errorRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `id_resolver_v2_errors_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const canProcess = expandedFile && libraryFile && lessonFile &&
        Object.values(mapping).every(v => v !== '');

    return (
        <div className="max-w-7xl mx-auto animate-fade-in pb-20">

            {/* Header */}
            <div className="flex justify-between items-center mb-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                        <Link2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">ID Resolver v2</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Column-mapped deterministic matching</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowInfo(true)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all"
                        title="About ID Resolver"
                    >
                        <Info className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2.5 rounded-xl transition-all ${showSettings ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800'}`}
                        title="Manual Column Mapping"
                    >
                        <Settings className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* File Uploads */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Expanded Rows */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        Expanded Rows - Methods Doc
                    </h3>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center mb-4">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, setExpandedFile, (h) => {
                                    setExpandedHeaders(h);
                                    autoSuggestMapping(h, 'expanded');
                                });
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

                    {expandedFile && (
                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                            {[
                                { label: 'LuL', key: 'triad_column' },
                                { label: 'Can-do', key: 'can_do_column' },
                                { label: 'CEFR', key: 'cefr_column' },
                                { label: 'Skill', key: 'skill_column' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{field.label}</label>
                                    <select
                                        value={(mapping as any)[field.key]}
                                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                        className="w-full p-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    >
                                        <option value="">Select column...</option>
                                        {expandedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Full Library */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-500" />
                        Full Competency Library Export
                    </h3>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center mb-4">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, setLibraryFile, (h) => {
                                    setLibraryHeaders(h);
                                    autoSuggestMapping(h, 'library');
                                });
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

                    {libraryFile && (
                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                            {[
                                { label: 'Competency ID', key: 'library_id_column' },
                                { label: 'Can-do', key: 'library_can_do_column' },
                                { label: 'CEFR', key: 'library_cefr_column' },
                                { label: 'Skill', key: 'library_skill_column' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{field.label}</label>
                                    <select
                                        value={(mapping as any)[field.key]}
                                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                        className="w-full p-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    >
                                        <option value="">Select column...</option>
                                        {libraryHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lessons */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-500" />
                        Lessons - Full Export
                    </h3>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center mb-4">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, setLessonFile, (h) => {
                                    setLessonHeaders(h);
                                    autoSuggestMapping(h, 'lesson');
                                });
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

                    {lessonFile && (
                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                            {[
                                { label: 'Lesson ID', key: 'lesson_id_column' },
                                { label: 'LuL', key: 'lesson_lul_column' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{field.label}</label>
                                    <select
                                        value={(mapping as any)[field.key]}
                                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                        className="w-full p-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                    >
                                        <option value="">Select column...</option>
                                        {lessonHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Process Button */}
            <div className="flex justify-center mb-8">
                <button
                    onClick={handleProcess}
                    disabled={!canProcess || loading}
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black shadow-lg transition-all transform active:scale-95 text-xs uppercase tracking-widest ${!canProcess || loading
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:-translate-y-1'
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

            {/* Guard Logic Warning */}
            {
                !canProcess && expandedFile && libraryFile && lessonFile && (
                    <div className="flex justify-center mb-4">
                        <p className="text-orange-600 dark:text-orange-400 font-bold text-sm bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center gap-2 animate-pulse">
                            <AlertCircle className="w-4 h-4" />
                            ⚠️ Please select all required columns before resolving IDs.
                        </p>
                    </div>
                )
            }

            {/* Error Display */}
            {
                error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 mb-6">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                    </div>
                )
            }

            {/* Results */}
            {
                result && (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ID Resolution Summary
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-center">
                                    <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{result.stats.total_rows}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Rows</div>
                                </div>
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                                    <div className="text-2xl font-black text-green-600 dark:text-green-400">{result.stats.competency_matches}</div>
                                    <div className="text-[10px] uppercase font-bold text-green-500 tracking-wider">Comp Matches</div>
                                </div>
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center">
                                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{result.stats.skill_conflicts}</div>
                                    <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Skill Conflicts</div>
                                </div>
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                                    <div className="text-2xl font-black text-red-600 dark:text-red-400">{result.stats.competency_misses}</div>
                                    <div className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Comp Misses</div>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                                    <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{result.stats.lesson_matches}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lesson Matches</div>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                                    <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{result.stats.lesson_misses}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lesson Misses</div>
                                </div>
                            </div>
                        </div>

                        {/* Download Buttons */}
                        <div className="flex justify-center gap-4 mt-8">
                            {result.matched.length > 0 && (
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-lg shadow-indigo-500/20 text-xs uppercase tracking-widest"
                                >
                                    <Download className="w-5 h-5" />
                                    Download Resolved CSV
                                </button>
                            )}
                            {(result.stats.competency_misses > 0 || result.stats.skill_conflicts > 0 || result.stats.lesson_misses > 0) && (
                                <button
                                    onClick={handleDownloadErrors}
                                    className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-black transition-all shadow-lg text-xs uppercase tracking-widest"
                                >
                                    <Download className="w-5 h-5" />
                                    Download Error Report
                                </button>
                            )}
                        </div>

                        {/* Preview Table */}
                        <div className="mt-8 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 overflow-x-auto">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 px-2">Sample Output (Top 5 Rows)</h4>
                            <table className="w-full text-left text-xs text-slate-500 border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 border-b border-slate-200 dark:border-slate-700">Competency ID</th>
                                        <th className="p-2 border-b border-slate-200 dark:border-slate-700">Lesson ID</th>
                                        <th className="p-2 border-b border-slate-200 dark:border-slate-700">Match Flags</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.matched.slice(0, 5).map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="p-2 font-mono text-[10px]">{row.competency_id || '---'}</td>
                                            <td className="p-2 font-mono text-[10px]">{row.lesson_id || '---'}</td>
                                            <td className="p-2">
                                                <div className="flex gap-1 flex-wrap">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                        row.competency_match_found
                                                            ? 'bg-green-100 text-green-700'
                                                            : row.skill_mismatch
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {row.competency_match_found ? 'Comp ✓' : row.skill_mismatch ? 'Skill Conflict' : 'Comp ✗'}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${row.lesson_match_found ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        Lesson {row.lesson_match_found ? '✓' : '✗'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            {/* Info Modal */}
            {showInfo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Info className="w-5 h-5 text-blue-500" />
                                About ID Resolver
                            </h3>
                            <button onClick={() => setShowInfo(false)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <XCircle className="w-5 h-5 text-slate-500" />
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
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center">
                            <button onClick={() => setShowInfo(false)} className="px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors">
                                Got It
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Column Mapping Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-blue-500" />
                                Manual Column Mapping
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                <XCircle className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto">
                            <div className="grid md:grid-cols-3 gap-8">
                                {/* Expanded Rows Mapping */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-900 dark:text-white border-b pb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Expanded Rows - Methods Doc</h4>
                                    {[
                                        { label: 'LuL', key: 'triad_column' },
                                        { label: 'Can-do', key: 'can_do_column' },
                                        { label: 'CEFR', key: 'cefr_column' },
                                        { label: 'Skill', key: 'skill_column' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{f.label}</label>
                                            <select
                                                value={(mapping as any)[f.key]}
                                                onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                                                className="w-full p-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                            >
                                                <option value="">Select...</option>
                                                {expandedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>

                                {/* Full Library Mapping */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-900 dark:text-white border-b pb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-green-500" /> Full Competency Library Export</h4>
                                    {[
                                        { label: 'Comp ID', key: 'library_id_column' },
                                        { label: 'Can-do', key: 'library_can_do_column' },
                                        { label: 'CEFR', key: 'library_cefr_column' },
                                        { label: 'Skill', key: 'library_skill_column' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{f.label}</label>
                                            <select
                                                value={(mapping as any)[f.key]}
                                                onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                                                className="w-full p-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                            >
                                                <option value="">Select...</option>
                                                {libraryHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>

                                {/* Lessons Mapping */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-900 dark:text-white border-b pb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-purple-500" /> Lessons - Full Export</h4>
                                    {[
                                        { label: 'Lesson ID', key: 'lesson_id_column' },
                                        { label: 'LuL', key: 'lesson_lul_column' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{f.label}</label>
                                            <select
                                                value={(mapping as any)[f.key]}
                                                onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                                                className="w-full p-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900"
                                            >
                                                <option value="">Select...</option>
                                                {lessonHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center">
                            <button onClick={() => setShowSettings(false)} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20">
                                Save Mapping & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
