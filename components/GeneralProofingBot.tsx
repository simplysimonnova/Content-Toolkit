import React, { useState, useRef } from 'react';
import { ClipboardCheck, FileText, Play, Loader2, AlertCircle, Trash2, Copy, Check, Info, FileUp, X, SearchCheck, FileCode, Settings } from 'lucide-react';
// Corrected: changed generateProofingReport to generateProofReport
import { generateProofReport } from '../services/geminiService';
import { ToolSettingsModal } from './ToolSettingsModal';
import { useAuth } from '../context/AuthContext';
import mammoth from 'mammoth';

export const GeneralProofingBot: React.FC = () => {
  const { isAdmin } = useAuth();
  const [inputText, setInputText] = useState('');
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const extractTextFromDocx = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value);
        } catch (err) {
          reject(new Error("Failed to extract text from Word document."));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isDocx = file.name.endsWith('.docx') || file.name.endsWith('.doc');
      
      if (isPdf || isDocx) {
        setInputFile(file);
        setInputText(''); 
        setError(null);
      } else {
        setError("Please upload a valid PDF or Word (.docx) file.");
      }
    }
  };

  const runProofing = async () => {
    if (!inputText.trim() && !inputFile) {
      setError("Please provide content to proofread.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      let data: string | { data: string; mimeType: string };
      
      if (inputFile) {
        const isPdf = inputFile.type === 'application/pdf' || inputFile.name.endsWith('.pdf');
        if (isPdf) {
          const base64 = await fileToBase64(inputFile);
          data = { data: base64, mimeType: 'application/pdf' };
        } else {
          const text = await extractTextFromDocx(inputFile);
          if (!text.trim()) {
             throw new Error("The Word document appears to be empty.");
          }
          data = text;
        }
      } else {
        data = inputText;
      }

      // Corrected: changed generateProofingReport to generateProofReport
      const findings = await generateProofReport(data);
      setResult(findings);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during proofreading.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isDocx = inputFile?.name.endsWith('.docx') || inputFile?.name.endsWith('.doc');

  const fullProofingPrompt = `You are a professional educational editor specializing in UK English.

AUDIT CRITERIA:
1. SPELLING: Strict UK English only (e.g., 'colour' not 'color', 'organise' not 'organize').
2. GRAMMAR: Ensure professional A2-level accessibility.
3. HEADINGS: Verify all headers follow a consistent hierarchy and capitalization style.
4. TONE: Ensure consistency. Only suggest revisions if the writing feels incomplete or wildly deviates from educational standards.

OUTPUT: Provide a clear, actionable list of findings. Use bullet points for easy reading.`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <SearchCheck className="w-7 h-7 text-indigo-500" />
            General Proofing Bot
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Audit documents for UK English, formatting consistency, and tone.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowSettings(true)} className="p-3 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition-all">
             <Settings className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Source Material
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                    inputFile ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  }`}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.doc" className="hidden" />
                  {inputFile ? (
                    <div className="flex flex-col items-center p-4">
                      {isDocx ? <FileCode className="w-8 h-8 text-blue-500 mb-2" /> : <FileText className="w-8 h-8 text-indigo-500 mb-2" />}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{inputFile.name}</span>
                      <button onClick={(e) => {e.stopPropagation(); setInputFile(null);}} className="mt-1 text-[10px] text-red-500 font-bold flex items-center gap-1 hover:underline"><X className="w-3 h-3" /> Remove</button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <FileUp className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-xs font-medium text-slate-500">Upload PDF or Word</span>
                    </div>
                  )}
                </div>

                <textarea 
                  placeholder="Or paste text content here..."
                  value={inputText}
                  onChange={(e) => {setInputText(e.target.value); if(e.target.value) setInputFile(null);}}
                  className="w-full h-48 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs resize-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button 
                onClick={runProofing}
                disabled={isProcessing}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {isProcessing ? 'Analysing Content...' : 'Run Proofing Audit'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col h-full">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <SearchCheck className="w-4 h-4 text-indigo-500" />
                Audit Findings
              </h3>
              {result && (
                <button onClick={handleCopy} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Report'}
                </button>
              )}
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
              {isProcessing ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-sm font-medium text-slate-400 uppercase tracking-widest animate-pulse">Running Scan...</p>
                </div>
              ) : result ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{result}</div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 text-center">
                  <ClipboardCheck className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm font-medium">Findings will appear here after analysis.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ToolSettingsModal 
        toolId="proofing-bot" 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        defaultPrompt={fullProofingPrompt} 
      />
    </div>
  );
};