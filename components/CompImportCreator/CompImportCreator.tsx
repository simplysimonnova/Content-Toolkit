import React, { useState } from 'react';
import { TableProperties, FileSpreadsheet, Play, Download, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateCompImport } from './ai';

interface ProcessedItem {
    statement: string;
    skill: string;
    cefr: string;
}

export const CompImportCreator: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedData, setProcessedData] = useState<ProcessedItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);

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

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(processedData);

        // Apply specific column widths if possible (basic width setting)
        const wscols = [
            { wch: 60 }, // statement
            { wch: 15 }, // skill
            { wch: 10 }, // cefr
        ];
        worksheet['!cols'] = wscols;

        XLSX.utils.book_append_sheet(workbook, worksheet, "Can Do Statements");

        // Generate filename with timestamp
        const fileName = `CompImport_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;

        // Download file
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in space-y-8">

            {/* Header */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                        <TableProperties className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Comp Import Creator</h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Transform raw "Student can..." statements into an import-ready spreadsheet with AI-powered tagging.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Input Section */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col">
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
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col animate-fade-in-up">
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
                                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all hover:-translate-y-0.5"
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
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                            <div className="p-4 bg-white dark:bg-slate-800 rounded-full mb-4 shadow-sm">
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
        </div>
    );
};
