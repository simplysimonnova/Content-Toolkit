import React from 'react';
import { Info, X, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AIQAInfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">

      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Info className="w-5 h-5 text-indigo-500" />
          AI QA Runner
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="p-8 overflow-y-auto space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed">

        <div>
          <h4 className="font-black text-slate-900 dark:text-white mb-2 text-xs uppercase tracking-widest">Purpose</h4>
          <p className="text-sm">Runs a structured AI quality review on a lesson PDF export. Extracts slide content and speaker notes, runs deterministic pre-checks, then calls the AI model to produce a scored compliance report stored in Firestore.</p>
        </div>

        <div>
          <h4 className="font-black text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-widest">QA Modes</h4>
          <ul className="space-y-2">
            {[
              { mode: 'Full Lesson QA', desc: 'End-to-end review: instructional clarity, language appropriateness, notes completeness, structure, engagement, and timings.' },
              { mode: 'Chunk QA', desc: 'Evaluates a lesson chunk (subset of slides) for internal coherence, difficulty progression, and transitions.' },
              { mode: 'STEM QA', desc: 'Checks scientific/mathematical accuracy, age-appropriate complexity, hands-on activity quality, and STEM vocabulary.' },
              { mode: 'Post-Design QA', desc: 'Final review of designed slides: legibility signals, content consistency, completeness, and notes readiness.' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span><strong className="text-slate-800 dark:text-white">{item.mode}</strong> — {item.desc}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-black text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-widest">PDF Source Types</h4>
          <ul className="space-y-2">
            {[
              { source: 'Google Slides (GSlides)', desc: 'Speaker notes are embedded inline on the slide page. Heuristic splitting is used to separate slide text from notes.' },
              { source: 'Slides.com export', desc: 'Notes appear as separate high-density text pages. Pairing is done by content density detection — not odd/even ordering.' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span><strong className="text-slate-800 dark:text-white">{item.source}</strong> — {item.desc}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-black text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-widest">What it does NOT do</h4>
          <ul className="space-y-2">
            {[
              'Re-download or store the raw PDF permanently',
              'Replace human editorial review',
              'Couple to any external project tool (Jira, etc.)',
              'Allow overwriting of saved QA run results',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <h4 className="font-black text-indigo-800 dark:text-indigo-300 mb-2 text-xs uppercase tracking-widest">Pipeline Position</h4>
          <p className="text-sm text-indigo-700 dark:text-indigo-400">Run after TN Standardization and before final editorial sign-off.</p>
          <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">All QA runs are immutable and stored in Firestore under <code className="font-mono text-xs">qa_runs</code>.</p>
        </div>

      </div>

      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center">
        <button
          onClick={onClose}
          className="px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
        >
          Got It
        </button>
      </div>
    </div>
  </div>
  );
};
