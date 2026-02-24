import React, { useState, useEffect } from 'react';
import { X, Save, Terminal, Loader2, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import type { QAMode } from './types';
import { QA_MODE_LABELS } from './types';

const DEFAULT_PROMPTS: Record<QAMode, string> = {
  'full-lesson': `You are a senior instructional quality reviewer for Novakid, an online English school for children aged 4–12.

You will receive a structured lesson PDF export with slide text and speaker notes.
Your task is to perform a comprehensive QA review and return a strict JSON report.

EVALUATE:
1. Instructional clarity — are teacher instructions clear, step-by-step, and actionable?
2. Language appropriateness — is vocabulary and complexity suitable for the target age group?
3. Speaker notes completeness — do all key slides have adequate notes?
4. Slide structure — logical flow, proper labeling (Title slide, Warm-up, Extension, etc.)
5. Engagement — are activities varied and interactive?
6. Timing — are timings present where required?

SCORING (0–100):
- Instructional Clarity: 0–25
- Language Appropriateness: 0–25
- Notes Completeness: 0–20
- Structure & Flow: 0–15
- Engagement: 0–15

VERDICT RULES:
- pass: total ≥ 80, no critical issues
- pass-with-warnings: total ≥ 65, no critical issues
- revision-required: total < 65 OR any critical issue
- fail: total < 40 OR multiple critical issues`,

  'chunk-qa': `You are a QA reviewer for chunked lesson segments at Novakid.
Evaluate this lesson chunk (a subset of slides) for:
1. Internal coherence — does the chunk stand alone logically?
2. Speaker notes — adequate for the chunk's activities?
3. Difficulty progression — appropriate within chunk?
4. Transitions — clear entry/exit points?

SCORING (0–100):
- Coherence: 0–30
- Notes Quality: 0–25
- Difficulty: 0–25
- Transitions: 0–20

VERDICT RULES:
- pass: total ≥ 75
- pass-with-warnings: total ≥ 60
- revision-required: total < 60
- fail: total < 40`,

  'stem-qa': `You are a STEM content quality reviewer for Novakid.
Evaluate this STEM lesson for:
1. Scientific/mathematical accuracy — are facts, formulas, and concepts correct?
2. Age-appropriate complexity — suitable for the target level?
3. Hands-on activity quality — clear, safe, and achievable?
4. Visual support — diagrams and images described adequately?
5. Vocabulary — STEM terms introduced and explained?

SCORING (0–100):
- Accuracy: 0–30
- Complexity: 0–25
- Activity Quality: 0–20
- Visual Support: 0–15
- Vocabulary: 0–10

VERDICT RULES:
- pass: total ≥ 75
- pass-with-warnings: total ≥ 60
- revision-required: total < 60 OR any factual error
- fail: total < 40`,

  'post-design-qa': `You are a post-design QA reviewer for Novakid lesson slides.
Evaluate the final designed lesson for:
1. Text legibility — font sizes, contrast, readability
2. Content consistency — does slide text match speaker notes?
3. Completeness — no missing elements, placeholders, or TODOs
4. Branding compliance — appropriate tone and style
5. Final slide notes — are all final speaker notes production-ready?

SCORING (0–100):
- Legibility signals: 0–25
- Content consistency: 0–30
- Completeness: 0–25
- Notes readiness: 0–20

VERDICT RULES:
- pass: total ≥ 80
- pass-with-warnings: total ≥ 65
- revision-required: total < 65
- fail: total < 40`,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AIQASettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isAdmin } = useAuth();
  const [selectedMode, setSelectedMode] = useState<QAMode>('full-lesson');
  const [instruction, setInstruction] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const toolId = `ai-qa-runner-${selectedMode}`;

  useEffect(() => {
    if (!isOpen) return;
    loadPrompt(selectedMode);
  }, [isOpen, selectedMode]);

  const loadPrompt = async (mode: QAMode) => {
    setLoading(true);
    try {
      const d = await getDoc(doc(db, 'configurations', `ai-qa-runner-${mode}`));
      if (d.exists()) {
        const data = d.data();
        setInstruction(data.instruction || DEFAULT_PROMPTS[mode]);
        setIsLocked(!!data.isLocked);
      } else {
        setInstruction(DEFAULT_PROMPTS[mode]);
        setIsLocked(false);
      }
    } catch (e) {
      setInstruction(DEFAULT_PROMPTS[mode]);
      setIsLocked(false);
    }
    setLoading(false);
  };

  const handleModeChange = (mode: QAMode) => {
    setSelectedMode(mode);
  };

  const handleSave = async () => {
    if (!isAdmin) { alert('Access Denied: Admin privileges required.'); return; }
    setSaving(true);
    try {
      await setDoc(doc(db, 'configurations', toolId), {
        instruction,
        isLocked,
        updatedAt: new Date().toISOString(),
        toolId,
        mode: selectedMode,
      });
      alert(`Prompt for "${QA_MODE_LABELS[selectedMode]}" saved successfully.`);
      onClose();
    } catch (e) {
      console.error('Save Error:', e);
      alert('Error saving configuration.');
    }
    setSaving(false);
  };

  const toggleLock = () => {
    if (!isAdmin) return;
    if (isLocked && !confirm("Unlock this prompt? This allows modifications that could affect QA consistency.")) return;
    setIsLocked(!isLocked);
  };

  const handleReset = () => {
    if (!confirm(`Reset the "${QA_MODE_LABELS[selectedMode]}" prompt to the built-in default?`)) return;
    setInstruction(DEFAULT_PROMPTS[selectedMode]);
    setIsLocked(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3 text-orange-500">
            <Terminal className="w-6 h-6" />
            <div>
              <h3 className="text-xl font-bold dark:text-white leading-tight">AI QA System Prompts</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Per-Mode Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-6 pt-4 pb-0 border-b border-slate-100 dark:border-slate-800 flex gap-1 overflow-x-auto">
          {(Object.keys(QA_MODE_LABELS) as QAMode[]).map(m => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
                selectedMode === m
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {QA_MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {isLocked ? (
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl flex items-start gap-3 border border-teal-100 dark:border-teal-800">
              <Lock className="w-5 h-5 text-teal-600 dark:text-teal-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-teal-800 dark:text-teal-400 mb-1">STABLE MODE: Prompt Locked</p>
                <p className="text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                  This prompt is certified stable. Unlock to make edits.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-start gap-3 border border-amber-100 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">DANGER ZONE: Admin Only</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  You are editing the live system prompt for <strong>{QA_MODE_LABELS[selectedMode]}</strong>. Changes affect all QA runs for this mode.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-orange-500 w-10 h-10 mb-4" />
              <p className="text-sm text-slate-500">Loading prompt…</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute top-3 right-3 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700 pointer-events-none uppercase">
                {isLocked ? 'Read Only' : 'Editable'}
              </div>
              <textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                disabled={isLocked}
                rows={16}
                className={`w-full p-6 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-slate-300 shadow-inner resize-none leading-relaxed transition-opacity ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                placeholder="Enter the system prompt for this QA mode…"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLock}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${isLocked ? 'bg-teal-500 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {isLocked ? 'Locked' : 'Unlocked'}
            </button>
            <button
              onClick={handleReset}
              disabled={isLocked}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset to Default
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !isAdmin || isLocked}
            className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
            Save Prompt
          </button>
        </div>
      </div>
    </div>
  );
};
