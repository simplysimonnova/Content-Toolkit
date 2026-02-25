import React, { useEffect } from 'react';
import { X, ShieldCheck, Layers, AlertTriangle, Eye, Info } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">About Thematic QA Scanner</h2>
              <p className="text-[10px] text-slate-400 font-mono">v1.0.0 · Updated February 2026</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm text-slate-700 dark:text-slate-300">

          {/* What it does */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
              <Info className="w-3.5 h-3.5" /> What This Tool Does
            </h3>
            <p className="leading-relaxed">
              The Thematic QA Scanner analyses lesson content (PDF slides) for the presence of a specified theme. It uses a two-stage approach: AI-generated keyword expansion followed by text and visual scanning of every slide. The result is a structured compliance report with a risk level, matched terms, and visual flags.
            </p>
          </section>

          {/* Risk levels */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
              <AlertTriangle className="w-3.5 h-3.5" /> Risk Levels
            </h3>
            <div className="space-y-2">
              {[
                { level: 'None', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', desc: 'No thematic content found. Lesson is clear.' },
                { level: 'Low', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', desc: 'One minor or indirect match found. Review recommended.' },
                { level: 'Moderate', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', desc: 'Multiple indirect matches. Human review required before publishing.' },
                { level: 'High', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', desc: 'Direct thematic content present. Lesson must be reviewed and likely revised.' },
              ].map(({ level, color, desc }) => (
                <div key={level} className="flex items-start gap-3">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shrink-0 mt-0.5 ${color}`}>{level}</span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Batch processing */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
              <Layers className="w-3.5 h-3.5" /> Batch Processing
            </h3>
            <p className="leading-relaxed">
              Switch to <strong>Batch Mode</strong> to scan multiple lesson PDFs in a single run. Upload multiple files or paste multiple URLs (one per line). Files are processed sequentially. Failed scans are logged and skipped — the remaining files continue processing. A summary is shown at completion with the risk distribution across all files.
            </p>
          </section>

          {/* Visual disclaimer */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
              <Eye className="w-3.5 h-3.5" /> Visual Interpretation Disclaimer
            </h3>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
              <p className="leading-relaxed text-amber-800 dark:text-amber-300">
                Visual scanning is performed by an AI vision model and is inherently probabilistic. The tool only flags elements with high confidence, but it may miss subtle imagery or misidentify context-dependent visuals. Always treat visual matches as prompts for human review, not final verdicts. Adjust <strong>Visual Sensitivity</strong> in Settings to tune behaviour.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
