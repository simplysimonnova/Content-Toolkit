import React from 'react';
import { Info, X, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const TNInfoModal: React.FC<Props> = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Info className="w-5 h-5 text-indigo-500" />
          TN Standardization Module
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="p-8 overflow-y-auto space-y-6 text-slate-600 dark:text-slate-300 leading-relaxed">
        <div>
          <h4 className="font-black text-slate-900 dark:text-white mb-2 text-xs uppercase tracking-widest">Purpose</h4>
          <p className="text-sm">This module reformats Teacher Notes (TNs) into strict Novakid TN conventions before QA review.</p>
        </div>

        <div>
          <h4 className="font-black text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-widest">What it does</h4>
          <ul className="space-y-2">
            {[
              'Enforces step-by-step numbering (1, 2, 3 \u2014 no dots)',
              'Converts \u201cTeacher\u201d / \u201cStudent\u201d to T / S',
              'Applies required slide labels (Warm-up, Title slide, Drag and Drop, etc.)',
              'Standardizes slide headers in Full Lesson mode',
              'Adds timing rules where required',
              'Outputs structured JSON with fixedNotes and fixLog',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-black text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-widest">What it does NOT do</h4>
          <ul className="space-y-2">
            {[
              'Evaluate pedagogy or methodology',
              'Check CTQ or cultural compliance',
              'Score lesson quality',
              'Improve activity design',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <X className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <h4 className="font-black text-indigo-800 dark:text-indigo-300 mb-2 text-xs uppercase tracking-widest">Pipeline Position</h4>
          <p className="text-sm text-indigo-700 dark:text-indigo-400">Pre-QA formatting tool.</p>
          <p className="text-sm text-indigo-700 dark:text-indigo-400">Should be used before QA Agent review.</p>
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
