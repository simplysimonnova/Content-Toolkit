
/** @stability LOCKED - DO NOT MODIFY CODE WITHOUT EXPLICIT USER INSTRUCTION */

import React, { useState, useRef, useEffect } from 'react';
import { FileText, ClipboardList, Download, Play, Loader2, AlertCircle, Settings2, Trash2, CheckCircle2, Info, Upload, FileUp, X, TableProperties, Settings, Shield } from 'lucide-react';
import { generateTAF } from './ai';
import { DEFAULT_TAF_RULESET, TAFRuleset } from '../../constants/tafRules';
import { generateCSVForRows } from '../../utils/csvHelper';
import { ToolSettingsModal } from '../ToolSettingsModal';
import { useAuth } from '../../context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const TAFGenerator: React.FC = () => {
  const { isAdmin } = useAuth();
  const [lessonText, setLessonText] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState('');
  const [ruleset, setRuleset] = useState<TAFRuleset>(DEFAULT_TAF_RULESET);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const rulesInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configurations', 'taf-generator'), (snap) => {
      if (snap.exists()) {
        setIsLocked(!!snap.data().isLocked);
      }
    });
    return unsub;
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleOverrideRules = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (json.whitelist && json.slots) {
            setRuleset(json);
            alert("Ruleset updated successfully!");
          } else {
            throw new Error("Invalid format");
          }
        } catch (err) {
          alert("Failed to parse ruleset JSON. Please ensure it follows the correct schema.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setLessonFile(file);
      setLessonText('');
      setError(null);
    } else if (file) {
      setError("Please upload a valid PDF file.");
    }
  };

  const cleanStatements = (data: any): Record<string, string> => {
    const cleaned: Record<string, string> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        cleaned[key] = value.trim().replace(/\.+$/, '');
      } else {
        cleaned[key] = String(value);
      }
    });
    return cleaned;
  };

  const runGeneration = async () => {
    if (!lessonText.trim() && !lessonFile) {
      setError("Please provide lesson content (paste text or upload PDF).");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setResult(null);
    try {
      let lessonData: string | { data: string; mimeType: string };

      if (lessonFile) {
        const base64 = await fileToBase64(lessonFile);
        lessonData = { data: base64, mimeType: 'application/pdf' };
      } else {
        lessonData = lessonText;
      }

      const data = await generateTAF(lessonData, metadata, ruleset);

      let rowData = data;
      if (Array.isArray(data)) {
        rowData = data[0];
      } else if (data.results && Array.isArray(data.results)) {
        rowData = data.results[0];
      }

      if (rowData && typeof rowData === 'object') {
        setResult(cleanStatements(rowData));
      } else {
        throw new Error("AI returned an invalid data format.");
      }
    } catch (err: any) {
      if (err.message?.includes('API key')) {
        setError("API authentication failed. Please check environment.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const headers = Object.keys(result);
    const rowValues = Object.values(result) as string[];
    const csv = generateCSVForRows(headers, [rowValues]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TAF_Export_${Date.now()}.csv`;
    a.click();
  };

  const fullTafPrompt = `Generate TAF rows based on ruleset.\n\nWHITELIST VERBS: ${ruleset.whitelist.join(', ')}\n\nBLACKLIST VERBS: ${ruleset.blacklist.join(', ')}\n\nGENERAL RULES: ${ruleset.generalRules.join('. ')}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <TableProperties className="w-8 h-8 text-white" />
            </div>
            {isLocked && <Shield className="w-3.5 h-3.5 text-teal-500 absolute -top-1 -right-1 fill-white dark:fill-slate-900" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              TAF Generator
              {isLocked && <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-800">Stable</span>}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Create standalone "Today you..." statements from lesson content.</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowSettings(true)} className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all">
            <Settings className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Ruleset v{ruleset.version}
            </h3>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-tighter">Verb Whitelist</span>
                <div className="flex flex-wrap gap-1">
                  {ruleset.whitelist.slice(0, 8).map(v => (
                    <span key={v} className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] rounded border border-green-100 dark:border-green-800">{v}</span>
                  ))}
                  <span className="text-[10px] text-slate-400 italic">...and {ruleset.whitelist.length - 8} more</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => rulesInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Override Ruleset (.json)
                </button>
                <input type="file" ref={rulesInputRef} onChange={handleOverrideRules} accept=".json" className="hidden" />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-500 flex items-center gap-2 mb-2 uppercase tracking-widest">
              <Info className="w-4 h-4" />
              Truth Condition
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Statements must be true if the teacher ticks them. They must NOT be automatically true for every student. NO full stops allowed at the end.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-orange-500" />
              Lesson Content
            </h2>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Lesson Name / Metadata"
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Option A: Upload PDF</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${lessonFile
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500/50'
                      }`}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
                    {lessonFile ? (
                      <div className="flex flex-col items-center p-4 text-center">
                        <FileText className="w-10 h-10 text-orange-500 mb-2" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[150px]">{lessonFile.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setLessonFile(null); }}
                          className="mt-2 text-xs text-red-500 font-bold flex items-center gap-1 hover:underline"
                        >
                          <X className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <FileUp className="w-10 h-10 text-slate-400 mb-2" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Click to upload PDF</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Option B: Paste Text</label>
                  <textarea
                    placeholder="Alternatively, paste lesson text here..."
                    value={lessonText}
                    onChange={(e) => { setLessonText(e.target.value); if (e.target.value) setLessonFile(null); }}
                    className="w-full h-40 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => { setLessonText(''); setLessonFile(null); setMetadata(''); setResult(null); }}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Clear All
                </button>
                <button
                  onClick={runGeneration}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  Generate TAF Row
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <pre className="text-xs whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {result && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in-up">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500" />
                  Generated Output
                </h3>
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-colors shadow-sm shadow-indigo-500/20 uppercase tracking-widest"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse bg-[#0a0f1d]">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-700">
                      {Object.keys(result).map(key => (
                        <th key={key} className="px-6 py-4 border-r border-slate-700 last:border-0 font-black text-slate-400 tracking-widest uppercase text-[10px] whitespace-nowrap min-w-[250px]">
                          {key.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-[#0a0f1d]">
                      {Object.entries(result).map(([key, value]) => (
                        <td key={key} className="px-6 py-5 border-r border-slate-800 last:border-0 text-slate-300 align-top leading-relaxed font-medium">
                          {value}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToolSettingsModal
        toolId="taf-generator"
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        defaultPrompt={fullTafPrompt}
      />
    </div>
  );
};
