
import React from 'react';
import { X, Calendar, Tag, History, CheckCircle2 } from 'lucide-react';

interface LogEntry {
  version: string;
  date: string;
  title: string;
  type: 'Feature' | 'Improvement' | 'Fix';
  changes: string[];
}

const HISTORY: LogEntry[] = [
  {
    version: '1.4.0',
    date: 'February 2026',
    title: 'Content Workspace Rebrand, Thematic QA History & ID Resolver Overhaul',
    type: 'Feature',
    changes: [
      'Rebranded application name from "Content Toolkit" to "Content Workspace" in the sidebar header.',
      'Thematic QA: Added inline Scan History accessible via a clock icon in the tool header — opens the full Reports Dashboard as an overlay modal without leaving the page.',
      'Thematic QA: Header icon order standardised to Info (ℹ) → History (🕐) → Settings (⚙) across the tool.',
      'ID Resolver v2: Settings modal completely overhauled — removed duplicate column mapping (already on main page) and replaced with three toggle-based setting groups: Text Normalisation, Match Logic, and Output.',
      'ID Resolver v2: Added Reset button in the tool header — clears all uploaded files, column mappings, and results in one click without requiring a page refresh.',
      'ID Resolver v2: Settings modal footer now includes a "Reset to defaults" option alongside Save & Close.',
    ]
  },
  {
    version: '1.3.0',
    date: 'February 2026',
    title: 'Lesson QA Module & Ideas/Fixes System',
    type: 'Feature',
    changes: [
      'New Lesson QA tool — upload a lesson PDF, select QA mode (Full Lesson, Slide Structure, Speaker Notes, or Grammar), and run a full AI-powered quality review.',
      'Supports both Google Slides exports and Slides.com exports via smart PDF normalization and slide/notes pairing.',
      'Deterministic pre-checks block AI review on critical structural issues (e.g. missing slides, empty notes).',
      'Per-mode prompt editor (admin-only) stored in Firestore with lock/unlock controls.',
      'QA results saved to Firestore qa_runs collection with full scored report and flag breakdown.',
      'Renamed from "Run AI QA" to "Lesson QA" and moved into the Lesson Creation sidebar section.',
      'Feedback button renamed to "Ideas & Fixes" — users can now tag submissions as Idea (teal) or Bug/Fix (amber).',
      'Admin Console: new Ideas & Fixes tab showing all submissions with filter by type/status/search, card and list view, status update dropdown (New → In Review → Done → Rejected), and delete.',
      'My History tab in the Ideas & Fixes modal shows type and status badges per entry.'
    ]
  },
  {
    version: '1.2.0',
    date: 'February 2026',
    title: 'Workflow Navigation & ID Resolver Enhancement',
    type: 'Improvement',
    changes: [
      'Reorganized sidebar navigation into 8 workflow-based sections: Planning & Curriculum, Lesson Creation, Validation & QA, LLM & Content Processing, Competency Pipeline, Media & Assets, Utilities, and Resources.',
      'Added step numbers to Competency Pipeline tools (1-6) for clear sequential workflow.',
      'All sidebar sections now default to collapsed state for cleaner UI.',
      'ID Resolver: Added Skill Mismatch Flagging — detects when can_do + CEFR match but skill differs.',
      'ID Resolver: New amber "Skill Conflicts" stat card in summary, separate from true competency misses.',
      'ID Resolver: Skill mismatch rows flagged with amber badge in preview table and included in error report download.'
    ]
  },
  {
    version: '1.1.0',
    date: 'February 2026',
    title: 'TN Standardization Module',
    type: 'Feature',
    changes: [
      'Integrated TN Standardization tool into the Content Toolkit.',
      'Reformats Teacher Notes into strict Novakid TN conventions (numbering, T/S abbreviations, slide labels, timings).',
      'Full Lesson Mode with PDF and PowerPoint (.pptx) file upload and slide-by-slide extraction.',
      'Info Modal with module purpose, pipeline position, and what the tool does and does not do.',
      'Settings Modal with locked core methodology (read-only) and editable additional admin instructions.',
      'Fix Log output panel showing all changes made and why.',
      'LocalStorage persistence for admin prompt customisations.',
      'Fixed broken JSX structure in Internal Notes form.'
    ]
  },
  {
    version: '1.0.2',
    date: 'February 2026',
    title: 'Deduplicator Reliability Update',
    type: 'Improvement',
    changes: [
      'Implemented "Strict Semantic Deduplication" (ignoring quotes, casing across all keys).',
      'Enforced "Stateless Execution" to prevent data leakage between runs.',
      'Added Usage Logging for Admin Hub tracking.',
      'Updated tool documentation with clear 3-step import workflow.'
    ]
  },
  {
    version: '0.5.0',
    date: 'March 2026',
    title: 'Immutable Component Protocol',
    type: 'Feature',
    changes: [
      'Implemented "Stable-State" locking for core AI components.',
      'Added code-level machine-readable @stability tags to prevent AI regressions.',
      'Introduced Firestore-backed logic locking (isLocked) to freeze system prompts.',
      'Added visual "Shield" badges to Sidebar and headers for verified stable tools.',
      'Automated "Stability Warnings" in AI requests for production-certified prompts.',
      'Enhanced Tool Settings Modal with admin-only unlock/lock toggles.'
    ]
  },
  {
    version: '0.4.2',
    date: 'February 2026',
    title: 'Dynamic Sidebar & Role Management',
    type: 'Feature',
    changes: [
      'Implemented Firestore-driven sidebar navigation.',
      'Added Admin Drag & Drop (Ordering) for tool categories.',
      'Refined role-based access for "Lesson Proofing Bot".',
      'Integrated external prototype links for development features.'
    ]
  },
  {
    version: '0.4.0',
    date: 'January 2026',
    title: 'AI Tool Expansion',
    type: 'Feature',
    changes: [
      'Added General Proofing Bot with PDF/Word support.',
      'Launched Nano Banana Studio integrated prototype.',
      'Improved Gemini 3 Flash response consistency.',
      'Added real-time system prompt overrides for Admins.'
    ]
  },
  {
    version: '0.3.5',
    date: 'December 2025',
    title: 'Editorial & Audio Suite',
    type: 'Improvement',
    changes: [
      'Released Sound Generator with .WAV and .MP3 export.',
      'Added Image URL Extractor for Slides.com integration.',
      'Enhanced Prompt Rewriter with character identity presets.'
    ]
  },
  {
    version: '0.2.0',
    date: 'November 2025',
    title: 'Core Infrastructure',
    type: 'Feature',
    changes: [
      'Initial release of Lesson Description generator.',
      'Implemented TAF Row generation logic.',
      'Added Firebase Authentication and Role-based security.'
    ]
  }
];

export const ChangelogModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold dark:text-white">Changelog</h3>
              <p className="text-xs text-slate-500 font-medium">Historical project milestones</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {HISTORY.map((log, idx) => (
            <div key={log.version} className="relative pl-8">
              {idx !== HISTORY.length - 1 && (
                <div className="absolute left-[11px] top-8 bottom-[-40px] w-0.5 bg-slate-100 dark:bg-slate-800"></div>
              )}
              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-500 flex items-center justify-center z-10">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {log.date}
                </span>
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded">
                  v{log.version}
                </span>
              </div>

              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{log.title}</h4>

              <ul className="space-y-3">
                {log.changes.map((change, cIdx) => (
                  <li key={cIdx} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-3 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-teal-500 flex-shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm transition-transform active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
