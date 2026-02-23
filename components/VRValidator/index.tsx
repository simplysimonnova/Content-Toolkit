
import React, { useState } from 'react';
import { Map, CheckCircle2, AlertCircle, Loader2, Copy, Check, Trash2, Settings, ShieldCheck, Info, Code, ChevronDown, ChevronUp } from 'lucide-react';
import { validateVRLink } from './ai';
import { ToolSettingsModal } from '../ToolSettingsModal';
import { useAuth } from '../../context/AuthContext';

export const VRValidator: React.FC = () => {
  const { isAdmin } = useAuth();
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleValidate = async () => {
    if (!url.trim()) return;
    setIsProcessing(true);
    setResult(null);
    setShowReport(false);
    try {
      const response = await validateVRLink(url.trim());
      setResult(response);
    } catch (e) {
      alert("Validation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isValid = result?.toLowerCase().includes('valid') && !result?.toLowerCase().includes('not valid') && !result?.toLowerCase().includes('invalid');

  // Construct the markup manually to ensure absolute link fidelity with double curly braces
  const generatedMarkup = isValid ? `{{"VR":"${url.trim()}"}}` : null;

  const handleCopyMarkup = () => {
    if (!generatedMarkup) return;
    navigator.clipboard.writeText(generatedMarkup);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setUrl('');
    setResult(null);
    setShowReport(false);
  };

  const defaultPrompt = `Role: You are a technical validation tool for Novakid VR links.
Task: Check if the input is a valid Google Maps 360/Street View link.

Validation Rules:
1. Starts with https://www.google.com/maps/
2. Contains /place/
3. Contains @ section with coordinates.
4. Contains 360/Street View indicators: 3a, !3e11, or !1e1.
5. Must be a full URL.

Required Output Format:
If Valid: "✅ Valid VR link" followed by a detailed technical breakdown of the parameters found.
If Invalid: "❌ Invalid VR link" followed by a concise list of failed rules.

CRITICAL: The first line must strictly be either "✅ Valid VR link" or "❌ Invalid VR link".`;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Map className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">VR Link Validator</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Verify and wrap Google Maps 360° links for Novakid classrooms.</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Input Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
            Paste Google Maps URL
          </label>
          <textarea
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.google.com/maps/place/..."
            className="w-full h-32 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none p-4 text-sm font-mono resize-none transition-all"
          />
          <div className="flex justify-between items-center">
            <button onClick={handleClear} className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Clear Input
            </button>
            <button
              onClick={handleValidate}
              disabled={!url.trim() || isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95 text-xs uppercase tracking-widest"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              Validate Link
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Validation Status & Collapsible Report Box */}
          <div className={`rounded-2xl border overflow-hidden transition-colors ${isValid ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800'}`}>
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isValid ? <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" /> : <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />}
                <div>
                  <h3 className={`text-lg font-bold ${isValid ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {isValid ? 'Valid VR Link Found' : 'Validation Failed'}
                  </h3>
                  <p className={`text-sm mt-0.5 ${isValid ? 'text-green-700/80 dark:text-green-400/80' : 'text-red-700/80 dark:text-red-400/80'}`}>
                    {isValid ? 'Link meets all classroom requirements.' : 'Link is missing essential 360° parameters.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReport(!showReport)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isValid ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200'}`}
              >
                {showReport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showReport ? 'Hide Report' : 'Show Report'}
              </button>
            </div>

            {showReport && (
              <div className={`px-6 pb-6 pt-2 border-t ${isValid ? 'border-green-100 dark:border-green-800/50' : 'border-red-100 dark:border-red-800/50'} animate-fade-in`}>
                <div className={`p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-medium ${isValid ? 'bg-white/50 dark:bg-slate-900/50 text-green-800 dark:text-green-200' : 'bg-white/50 dark:bg-slate-900/50 text-red-800 dark:text-red-200'}`}>
                  {result.replace('✅ Valid VR link', '').replace('❌ Invalid VR link', '').trim()}
                </div>
              </div>
            )}
          </div>

          {/* System Markup Box - Only show if valid */}
          {isValid && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <Code className="w-4 h-4 text-slate-500" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Platform Markup
                  </h3>
                </div>
                <button
                  onClick={handleCopyMarkup}
                  className={`flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-sm ${copied
                      ? 'bg-green-500 text-white shadow-green-500/20'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Markup Copied' : 'Copy VR Markup'}
                </button>
              </div>

              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-inner group relative">
                <code className="text-blue-400 font-mono text-sm break-all leading-relaxed">
                  {generatedMarkup}
                </code>
              </div>

              <div className="mt-6 flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <Info className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Use this specific code block in your lesson slides. It ensures the classroom stage correctly initializes the interactive 360° environment for students.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <ToolSettingsModal
        toolId="vr-validator"
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        defaultPrompt={defaultPrompt}
      />
    </div>
  );
};
