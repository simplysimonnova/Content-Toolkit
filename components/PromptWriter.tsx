
import React, { useState } from 'react';
import { Sparkles, Copy, Check, Loader2, PenLine, Trash2, ArrowRight, UserCheck, Settings } from 'lucide-react';
import { generateNewImagePrompt } from '../services/geminiService';
import { ToolSettingsModal } from './ToolSettingsModal';
import { useAuth } from '../context/AuthContext';
import { IMAGE_STYLE_RULES } from '../constants/toolRules';

export const PromptWriter: React.FC = () => {
  const { isAdmin } = useAuth();
  const [keywords, setKeywords] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleGenerate = async () => {
    if (!keywords.trim()) return;

    setIsGenerating(true);
    setGeneratedPrompt('');
    try {
      const result = await generateNewImagePrompt(keywords);
      setGeneratedPrompt(result);
    } catch (error) {
      alert("Failed to generate prompt. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setKeywords('');
    setGeneratedPrompt('');
  };

  // RESTORED: Default prompt is now based on your 4 reference examples
  const fullPrompt = `You are an expert AI image prompt engineer for Novakid educational materials.

OBJECTIVE: Convert simple keywords into ONE SINGLE, detailed, consistent prompt for 2D educational illustrations.

STRICT FORMATTING RULES:
- Output exactly ONE prompt as a single paragraph. 
- Do NOT provide multiple options, lists, or variants.
- Start the prompt immediately with the subject description.
- Never add introductory text like "Here is your prompt."

STYLE GUIDELINES:
- Friendly educational cartoon style (Novakid aesthetic).
- bold, clear dark outlines.
- bright cheerful colors.
- simple clean shapes.
- technical: High contrast, entire subject visible, entire hair visible with space above.
- background: Completely transparent background with no shadows or ground elements.

TARGET STYLE REFERENCE:
"A friendly young Afro girl with deep warm brown skin... signature Novakid educational cartoon style... transparent background."

FULL STYLE SCHEMA:
${JSON.stringify(IMAGE_STYLE_RULES, null, 2)}`;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-8 transition-colors">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <PenLine className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Prompt Creator</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Expand simple keywords into full Novakid educational prompts.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/50 rounded-full mr-2">
              <UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">Character Sync On</span>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setShowSettings(true)} 
                className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                title="Global AI Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Enter Keyword(s)
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. Stonehenge, Astronaut, or Radishes..."
                className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-inner focus:border-orange-500 focus:ring-orange-500 dark:focus:border-orange-400 px-5 py-4 text-lg transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <button
                onClick={handleGenerate}
                disabled={!keywords.trim() || isGenerating}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white px-8 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 active:scale-95"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Generate
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 italic">
            <span>Powered by Novakid Consistency Style Engine</span>
            <button onClick={handleClear} className="flex items-center gap-1 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      </div>

      {(generatedPrompt || isGenerating) && (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 animate-fade-in-up transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-500" />
              Generated Prompt
            </h3>
            {generatedPrompt && (
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-sm ${
                  copied 
                  ? 'bg-teal-500 text-white' 
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Prompt Copied' : 'Copy Result'}
              </button>
            )}
          </div>

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-slate-100 dark:border-slate-700 border-t-orange-500 rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-slate-400 animate-pulse uppercase tracking-widest">Building your prompt...</p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-inner">
              <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap selection:bg-orange-100 dark:selection:bg-orange-500/30">
                {generatedPrompt}
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-100 dark:border-teal-800/30">
             <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-800 flex items-center justify-center flex-shrink-0">
               <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
             </div>
             <p className="text-xs text-teal-800/70 dark:text-teal-400/70 leading-relaxed font-medium">
                This prompt is optimized for Novakid's educational aesthetic. It ensures high contrast, simple shapes, and transparent backgrounds for versatile slide usage.
             </p>
          </div>
        </div>
      )}
      <ToolSettingsModal 
        toolId="prompt-writer" 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        defaultPrompt={fullPrompt} 
      />
    </div>
  );
};
