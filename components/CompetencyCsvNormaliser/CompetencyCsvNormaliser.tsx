import React, { useState } from 'react';
import { Settings, Info, Download, Play, TableProperties, ShieldCheck, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { normalizeCompetencies } from './ai';
import { ToolSettingsModal } from '../ToolSettingsModal';
import { useAuth } from '../../context/AuthContext';

interface CompetencyRow {
    can_do: string;
    skill: string;
    cefr: string;
    flag: string;
}

interface ReportStats {
    originalRows: number;
    newRows: number;
    createdCount: number;
    secondaryCreatedCount: number;
}

export const CompetencyCsvNormaliser: React.FC = () => {
    const [inputCsv, setInputCsv] = useState('');
    const [outputCsv, setOutputCsv] = useState('');
    const [rows, setRows] = useState<CompetencyRow[]>([]);
    const [stats, setStats] = useState<ReportStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const { isAdmin } = useAuth();
    const [error, setError] = useState<string | null>(null);

    const handleNormalize = async () => {
        if (!inputCsv.trim()) return;
        setLoading(true);
        setError(null);
        setStats(null);
        setRows([]);
        setOutputCsv('');

        try {
            const result = await normalizeCompetencies(inputCsv);
            setOutputCsv(result);

            // Parse CSV result for display and stats
            const lines = result.trim().split('\n');
            const parsedRows: CompetencyRow[] = [];
            let headerSkipped = false;

            lines.forEach(line => {
                if (!headerSkipped && line.toLowerCase().includes('can_do')) {
                    headerSkipped = true;
                    return;
                }
                // Simple CSV parse (handling quoted fields roughly for display)
                // Note: For robust parsing, a library is better, but this suffices for simple outputs
                const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                if (parts.length >= 3) {
                    parsedRows.push({
                        can_do: parts[0]?.trim().replace(/^"|"$/g, '') || '',
                        skill: parts[1]?.trim().replace(/^"|"$/g, '') || '',
                        cefr: parts[2]?.trim().replace(/^"|"$/g, '') || '',
                        flag: parts[3]?.trim().replace(/^"|"$/g, '') || ''
                    });
                }
            });

            setRows(parsedRows);

            // Input approximation (newlines in input)
            const inputRowCount = inputCsv.trim().split('\n').length - (inputCsv.toLowerCase().includes('cefr') ? 1 : 0);

            setStats({
                originalRows: Math.max(0, inputRowCount),
                newRows: parsedRows.length,
                createdCount: parsedRows.filter(r => r.flag === 'created' || r.flag === 'created-generic').length,
                secondaryCreatedCount: parsedRows.filter(r => r.flag === 'secondary created').length
            });

        } catch (err) {
            console.error(err);
            setError("An error occurred during normalization. Please check your input format or API key.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!outputCsv) return;
        const blob = new Blob([outputCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `normalized_competencies_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">

            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                        <div className="p-3 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                            <TableProperties className="w-8 h-8 text-white" />
                        </div>
                        Competency CSV Normaliser
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Methodologist-safe tool for preparing import-ready competency data.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowInfo(true)}
                        className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                        title="Tool Information"
                    >
                        <Info className="w-6 h-6" />
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                            title="Tool Settings"
                        >
                            <Settings className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="grid lg:grid-cols-2 gap-8">

                {/* Input Section */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                Input CSV File
                            </h2>
                        </div>

                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer relative group">
                            <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full group-hover:scale-110 transition-transform">
                                <FileText className="w-8 h-8 text-indigo-500" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                                {inputCsv ? "CSV File Loaded" : "Upload Competency Data"}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
                                {inputCsv ? "Ready to normalize. Click the button below." : "Drag and drop your CSV file here, or click to browse."}
                            </p>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                        const text = ev.target?.result as string;
                                        if (text) setInputCsv(text);
                                    };
                                    reader.readAsText(file);
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </div>

                        {inputCsv && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
                                File loaded ({inputCsv.length} bytes)
                            </div>
                        )}

                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={handleNormalize}
                                disabled={loading || !inputCsv.trim()}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 ${loading || !inputCsv.trim()
                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:-translate-y-1'
                                    }`}
                            >
                                {loading ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <Play className="w-5 h-5 fill-current" />
                                        Normalize Competencies
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Output Section */}
                <div className="space-y-6">

                    {/* Stats Report */}
                    {stats && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 animate-fade-in-up">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                Processing Report
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-center">
                                    <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{stats.originalRows}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Original Rows</div>
                                </div>
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-center">
                                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.newRows}</div>
                                    <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">New Version</div>
                                </div>
                                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-center">
                                    <div className="text-2xl font-black text-orange-500">{stats.createdCount}</div>
                                    <div className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Invented</div>
                                </div>
                                <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl text-center">
                                    <div className="text-2xl font-black text-teal-500">{stats.secondaryCreatedCount}</div>
                                    <div className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">Secondary</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 animate-shake">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Results Preview */}
                    {rows.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[500px]">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">Output Preview</h3>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Download CSV
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-0">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Can Do</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 w-24">Skill</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 w-16">CEFR</th>
                                            <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 w-24">Flag</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {rows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="p-3 text-xs text-slate-700 dark:text-slate-300 font-mono leading-relaxed">{row.can_do}</td>
                                                <td className="p-3 text-xs font-bold text-slate-600 dark:text-slate-400 capitalize">{row.skill}</td>
                                                <td className="p-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{row.cefr}</td>
                                                <td className="p-3">
                                                    {row.flag && (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${row.flag.includes('secondary') ? 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-900/30 dark:border-teal-800' :
                                                            row.flag.includes('created') ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800' :
                                                                'bg-slate-100 text-slate-500 border-slate-200'
                                                            }`}>
                                                            {row.flag}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Settings Modal */}
            <ToolSettingsModal
                toolId="competency-csv-normaliser"
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                defaultPrompt={`
You are a curriculum data-preparation tool designed to create import-ready competency rows while deliberately avoiding fine-grained pedagogical decisions.

Goal:
Ensure every required skill has a corresponding competency row, with correct CEFR alignment and clear flagging for human review — without attempting to fully design curriculum outcomes.

Input
A CSV containing:
- A CEFR Level Check column (may include multiple skill + CEFR pairs)
- A “Comps in Directus” column (may contain zero, one, or multiple competencies)
- Additional informational columns: Grammar, Vocabulary, Secondary Vocabulary, Speaking, Reading

Output Format (CSV)
Columns (exact order):
can_do, skill, cefr, flag

Core Rules

1. Competency Boundary Detection
Treat each case-insensitive occurrence of:
- "Student can …"
- "Students can …"
as the start of a new competency.
Ignore punctuation, line breaks, or spacing noise.

2. Preserve Existing Competencies
- Never modify, split, rewrite, or replace existing “Student(s) can …” statements.
- Existing competencies must pass through unchanged and unflagged.

3. Skill & CEFR Extraction
- Extract all Skill: CEFR pairs from the CEFR Level Check column.
- Normalize skills to lowercase: grammar, vocabulary, speaking, reading.
- Normalize CEFR to lowercase (pre-a1, a1, a2, b1).

4. Sequential Alignment
- Align existing competencies to extracted skill+CEFR pairs by position:
  1st competency ↔ 1st skill/CEFR
  2nd competency ↔ 2nd skill/CEFR
- Do not create Cartesian combinations.

5. Create Missing Competencies (Safe Mode)
- If a skill+CEFR pair has no corresponding competency, create one placeholder competency.
- Placeholders must:
  - Use standard “Student can …” phrasing
  - Match the skill and CEFR
  - Be generic but pedagogically safe
  - Avoid enumerating or splitting individual lexical or grammatical items
Examples (templates only):
Grammar → "Student can use the target grammatical structure accurately in context."
Vocabulary → "Student can use topic-specific vocabulary accurately in context."
Speaking → "Student can speak using appropriate language for the target context."
Reading → "Student can understand written texts on familiar topics."
- Flag all such rows as "created".

6. Secondary Vocabulary Handling
- Always create a vocabulary competency for Secondary Vocabulary if present.
- Do not split individual lexical items.
- Use a generic vocabulary placeholder.
- Infer CEFR using methodological alignment.
- Flag these rows as: "secondary created".

7. Generic Fallback
- If no usable information exists for a required skill, create a generic placeholder.
- Flag as: "created-generic".

8. Duplication Policy
- Do not deduplicate. Identical rows may pass through unchanged.

Design Constraints (Important)
- Do not split comma-separated or list-like content into multiple competencies.
- Do not attempt to infer teaching intent beyond safe placeholders.
- This tool prepares reviewable structure, not final curriculum.

Output Guarantee
- One row = one competency + one skill + one CEFR
- All created content is explicitly flagged
- Return strictly the CSV content.
`}
            />

            {/* Info Modal */}
            {showInfo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Info className="w-5 h-5 text-indigo-500" />
                                About This Tool
                            </h3>
                            <button
                                onClick={() => setShowInfo(false)}
                                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <div className="sr-only">Close</div>
                                <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-green-500" />
                                    What this tool does
                                </h4>
                                <p className="text-sm mb-2">This tool prepares competency (can-do) statements for import by ensuring that each required skill and CEFR level has a corresponding row. It:</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm marker:text-indigo-400">
                                    <li>Splits multiple competencies reliably using “Student(s) can …” as the boundary</li>
                                    <li>Aligns competencies to skills and CEFR levels</li>
                                    <li>Creates safe placeholder competencies where none exist</li>
                                    <li>Preserves all existing human-written can-dos exactly as they are</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-orange-500" />
                                    What this tool does NOT do
                                </h4>
                                <p className="text-sm mb-2">This tool does not attempt curriculum design. Specifically, it will not:</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm marker:text-orange-400">
                                    <li>Rewrite or improve existing can-do statements</li>
                                    <li>Decide which lexical or grammatical items deserve separate objectives</li>
                                    <li>Split lists into multiple competencies</li>
                                    <li>Make fine-grained pedagogical judgments</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Understanding Flags</h4>
                                <div className="grid gap-2">
                                    <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg flex gap-3 text-sm">
                                        <code className="text-xs font-bold text-slate-500 bg-white dark:bg-slate-600 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-500 h-fit">(empty)</code>
                                        <span>Original competency from the source data</span>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg flex gap-3 text-sm">
                                        <code className="text-xs font-bold text-orange-600 bg-white dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800 h-fit">created</code>
                                        <span>A placeholder competency created because none existed for that skill</span>
                                    </div>
                                    <div className="bg-teal-50 dark:bg-teal-900/10 p-3 rounded-lg flex gap-3 text-sm">
                                        <code className="text-xs font-bold text-teal-600 bg-white dark:bg-teal-900/20 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800 h-fit">secondary created</code>
                                        <span>A secondary vocabulary competency created for coverage</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center">
                            <button
                                onClick={() => setShowInfo(false)}
                                className="px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
