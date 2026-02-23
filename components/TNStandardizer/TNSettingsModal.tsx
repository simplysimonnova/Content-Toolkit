import React from 'react';
import { Settings, X, Lock, Unlock, AlertTriangle, Save, Loader2 } from 'lucide-react';

const LOCKED_PROMPT_DISPLAY = `ROLE
You are "Novakid Teacher Notes Fixer Bot." Your job is to rewrite Teacher Notes (TNs) into the correct Novakid TN format using the rules below.

TASK
Rewrite Teacher Notes (TNs) following the strict Novakid conventions provided.

OUTPUT REQUIREMENTS (STRICT)
You MUST output a JSON object with two fields: "fixedNotes" and "fixLog".

1) "fixedNotes":
- Use SLIDE HEADERS: "### SLIDE [N] ###" to separate slides in full lesson mode.
- Use multi-step numbering: 1, 2, 3… (no dots, no TN1).
- Use abbreviations: T (Teacher) and S (Student) – NO DOTS.
- Include timings (mins/secs) for non-chunked lessons (unless < 30s).
- Use specific labels: "Quick slide", "Title slide", "Warm-up", "Drag and Drop", "Extension slide", etc.
- Multi-fragment slides: Specify "Last fragment: ____".

2) "fixLog":
- Concise explanation of violations found and changes made.

BOT PROMPT: Teacher Notes (TN) Conventions

1) General TN formatting
- TNs should generally be numbered (1, 2...) and written in a step-by-step format.
- If there is only one step, numbering is optional.
- TNs must be as concise as possible, but still clear.
- Intuitive slides: write only "Quick slide".

2) Timings
- Non-chunked lessons: each slide must include a timing in mins or secs (do NOT use ">").
- Timing < 30s: write "Quick slide" instead of timing.
- Extension slides: label "Extension slide" (no timing).

3) Chunked lessons
- On the first main slide of each chunk (NOT title/warm-up), include: "Chunk X (Y slides). Z mins".

4) Required labels (Exact strings):
- Title slide: "Title slide. Do not spend time here. Move straight to next slide."
- Vertical slide (1.2): "For teacher use only."
- Warm-up slide: "Warm-up"
- Self-evaluation slides: "Self-evaluation slide"
- Drag and Drop slides: "Drag and Drop"
- Extension slides: "Extension slide"

5) Abbreviations:
- Teacher → T
- Student → S

6) Multi-step instructions:
- Each instruction on a separate line.
- Number them 1, 2, 3…
- Steps must be truly sequential.

7) Multiple fragments:
- Specify last fragment: "Last fragment: ____"

QUALITY CHECK:
- Section 1: Teacher Notes (numbering 1, 2, 3, T/S only, labels, SLIDE headers).
- Section 2: Fix Log (What & Why).`;

interface Props {
  additionalInstructions: string;
  setAdditionalInstructions: (v: string) => void;
  isLocked: boolean;
  setIsLocked: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export const TNSettingsModal: React.FC<Props> = ({
  additionalInstructions,
  setAdditionalInstructions,
  isLocked,
  setIsLocked,
  saving,
  onSave,
  onClose,
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
    <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">

      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">TN Standardizer Settings</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">System Prompt Configuration</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="p-6 space-y-5 overflow-y-auto flex-1">

        {/* Lock status banner */}
        {isLocked ? (
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-start gap-3 border border-indigo-100 dark:border-indigo-800">
            <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">STABLE MODE: Methodology Locked</p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-400 leading-relaxed">
                The core TN methodology is locked and non-editable. Only the additional instructions section below can be modified.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-start gap-3 border border-amber-100 dark:border-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">UNLOCKED: Admin Mode</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                Core methodology is visible below (read-only). Add optional instructions in the editable section.
              </p>
            </div>
          </div>
        )}

        {/* Locked core prompt — always read-only */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Core Methodology (Read-only)
            </label>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border dark:border-slate-700 uppercase">Locked</span>
          </div>
          <textarea
            readOnly
            value={LOCKED_PROMPT_DISPLAY}
            rows={14}
            className="w-full p-4 font-mono text-xs bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-500 resize-none cursor-not-allowed opacity-70 outline-none leading-relaxed"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Additional Admin Instructions (Optional)</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Editable additional instructions */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            Appended to prompt — editable
          </label>
          <textarea
            value={additionalInstructions}
            onChange={e => setAdditionalInstructions(e.target.value)}
            rows={5}
            placeholder="Add any clarification notes or extra rules here. These will be appended after the locked methodology..."
            className="w-full p-4 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 resize-none outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all leading-relaxed"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            isLocked
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
          }`}
        >
          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {isLocked ? 'Locked (Stable)' : 'Unlocked (Beta)'}
        </button>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  </div>
);
