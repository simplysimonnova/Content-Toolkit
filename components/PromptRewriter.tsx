
import React, { useState } from 'react';
import { Sparkles, Copy, Check, RefreshCw, Wand2, Palette, Trash2, UserCircle, Shirt, ChevronRight, Play, Settings } from 'lucide-react';
import { rewriteImagePrompt } from '../services/geminiService';
import { ToolSettingsModal } from './ToolSettingsModal';
import { useAuth } from '../context/AuthContext';
import { IMAGE_STYLE_RULES } from '../constants/toolRules';

interface Preset {
  label: string;
  icon: string;
  instruction: string;
}

const CHARACTER_PRESETS: Preset[] = [
  { label: 'Asian Boy', icon: '👦🏻', instruction: 'Change the subject to a young Asian boy with straight dark hair and fair peach skin' },
  { label: 'Asian Girl', icon: '👩🏻', instruction: 'Change the subject to a young Asian girl with straight dark hair and fair peach skin' },
  { label: 'Latino Boy', icon: '👦🏽', instruction: 'Change the subject to a young Latino boy with warm tan skin and dark brown hair' },
  { label: 'Latina Girl', icon: '👩🏽', instruction: 'Change the subject to a young Latina girl with warm tan skin and dark brown hair' },
  { label: 'Afro Boy', icon: '👦🏾', instruction: 'Change the subject to a young Black boy with deep warm brown skin and short natural curly hair' },
  { label: 'Afro Girl', icon: '👩🏾', instruction: 'Change the subject to a young Black girl with deep warm brown skin and natural afro-textured hair' },
  { label: 'Caucasian Boy', icon: '👦🏼', instruction: 'Change the subject to a young Caucasian boy with light peach skin and light brown hair' },
  { label: 'Caucasian Girl', icon: '👩🏼', instruction: 'Change the subject to a young Caucasian girl with light peach skin and light brown hair' },
];

const COSTUME_PRESETS: Preset[] = [
  { label: 'Yellow Shirt', icon: '🟡', instruction: 'Change the T-shirt color to sunny yellow with clean white trim' },
  { label: 'Novakid Teal', icon: '🔵', instruction: 'Change the T-shirt color to bright teal blue with black trim' },
  { label: 'Red Hoodie', icon: '🔴', instruction: 'Change the outfit to a cozy red hoodie with the hood down' },
  { label: 'Lab Coat', icon: '🥼', instruction: 'Change the outfit to a professional white scientific lab coat over their clothes' },
  { label: 'Sports Jersey', icon: '⚽', instruction: 'Change the outfit to a sporty athletic jersey with a small number on the chest' },
  { label: 'Winter Coat', icon: '🧥', instruction: 'Change the outfit to a warm padded winter jacket with a fuzzy collar' },
];

export const PromptRewriter: React.FC = () => {
  const { isAdmin } = useAuth();
  const [sourcePrompt, setSourcePrompt] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState<Preset | null>(null);
  const [selectedCostume, setSelectedCostume] = useState<Preset | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleRewrite = async () => {
    if (!sourcePrompt.trim()) return;
    
    const instructions = [];
    if (selectedCharacter) instructions.push(selectedCharacter.instruction);
    if (selectedCostume) instructions.push(selectedCostume.instruction);
    if (customInstruction.trim()) instructions.push(customInstruction.trim());

    if (instructions.length === 0) {
      alert("Please select at least one transformation or enter a custom instruction.");
      return;
    }

    const combinedInstruction = instructions.join(' AND ');

    setIsProcessing(true);
    try {
      const result = await rewriteImagePrompt(sourcePrompt, combinedInstruction);
      setRevisedPrompt(result);
    } catch (error) {
      alert("Failed to rewrite prompt. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCharacter = (preset: Preset) => {
    setSelectedCharacter(prev => prev?.label === preset.label ? null : preset);
  };

  const handleToggleCostume = (preset: Preset) => {
    setSelectedCostume(prev => prev?.label === preset.label ? null : preset);
  };

  const handleCopy = () => {
    if (revisedPrompt) {
      navigator.clipboard.writeText(revisedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const useAsSource = () => {
    if (revisedPrompt) {
      setSourcePrompt(revisedPrompt);
      setRevisedPrompt('');
      setSelectedCharacter(null);
      setSelectedCostume(null);
      setCustomInstruction('');
    }
  };

  const handleClear = () => {
    setSourcePrompt('');
    setCustomInstruction('');
    setSelectedCharacter(null);
    setSelectedCostume(null);
    setRevisedPrompt('');
  };

  const fullPrompt = `You are an expert Novakid Prompt Redesigner. Your goal is to modify existing prompts while preserving technical consistency.\n\nCONSTRAINTS:\n- Maintain transparent backgrounds.\n- Keep high contrast and clear outlines.\n- Ensure the subject remains the central focus.\n\nSTRICT STYLE RULES:\n${JSON.stringify(IMAGE_STYLE_RULES, null, 2)}`;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-orange-500" />
                1. Base Prompt
              </h2>
              {isAdmin && (
                <button 
                  onClick={() => setShowSettings(true)} 
                  className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
            <textarea
              value={sourcePrompt}
              onChange={(e) => setSourcePrompt(e.target.value)}
              placeholder="Paste your base Novakid prompt here..."
              className="w-full h-40 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-inner focus:border-orange-500 focus:ring-orange-500 dark:focus:border-orange-400 p-4 text-sm resize-none transition-all placeholder:text-slate-400"
            />
            <div className="mt-3 flex justify-end">
              <button 
                onClick={handleClear}
                className="text-xs font-medium text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors px-2 py-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <RefreshCw className={`w-5 h-5 text-orange-500 ${isProcessing ? 'animate-spin' : ''}`} />
              2. Transformations
            </h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCircle className="w-4 h-4 text-teal-500" />
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Character Identity
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CHARACTER_PRESETS.map((preset, idx) => {
                    const isSelected = selectedCharacter?.label === preset.label;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleToggleCharacter(preset)}
                        disabled={isProcessing}
                        className={`flex flex-col items-center justify-center p-3 border rounded-xl text-[10px] font-bold transition-all disabled:opacity-50 ${
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-600 shadow-md scale-105 z-10'
                            : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-orange-50 dark:hover:bg-orange-500/10 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-2xl mb-1">{preset.icon}</span>
                        <span className="text-center leading-tight">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shirt className="w-4 h-4 text-orange-400" />
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Optional Costume Swap
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COSTUME_PRESETS.map((preset, idx) => {
                    const isSelected = selectedCostume?.label === preset.label;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleToggleCostume(preset)}
                        disabled={isProcessing}
                        className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                          isSelected
                            ? 'bg-teal-500 text-white border-teal-600 shadow-md scale-105 z-10'
                            : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-teal-50 dark:hover:bg-teal-500/10 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-lg">{preset.icon}</span>
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  Manual Instruction
                </label>
                <input
                  type="text"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="e.g. Add a red baseball cap..."
                  className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-inner focus:border-orange-500 focus:ring-orange-500 dark:focus:border-orange-400 px-4 py-3 text-sm transition-all mb-4"
                  onKeyDown={(e) => e.key === 'Enter' && handleRewrite()}
                />
                
                <button
                  onClick={handleRewrite}
                  disabled={!sourcePrompt.trim() || isProcessing}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                  {isProcessing ? 'Rewriting Prompt...' : 'Apply Transformations'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-teal-500" />
                Revised Result
              </h2>
              {revisedPrompt && (
                <div className="flex gap-2">
                  <button
                    onClick={useAsSource}
                    className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-all"
                    title="Chain another transformation"
                  >
                    <ChevronRight className="w-4 h-4" />
                    Use as Source
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full transition-all shadow-sm ${
                      copied 
                      ? 'bg-teal-500 text-white' 
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {!revisedPrompt && !isProcessing ? (
              <div className="flex-1 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">Ready to Transform</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                  Select a Character Identity and/or a Costume Swap, then click Apply.
                </p>
              </div>
            ) : isProcessing ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-700 border-t-orange-500 rounded-full animate-spin"></div>
                  <Wand2 className="w-6 h-6 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Recalibrating...</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-medium">Applying Novakid Style Constraints</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 overflow-y-auto shadow-inner">
                <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap selection:bg-orange-100 dark:selection:bg-orange-500/30">
                  {revisedPrompt}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ToolSettingsModal 
        toolId="prompt-rewriter" 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        defaultPrompt={fullPrompt} 
      />
    </div>
  );
};
