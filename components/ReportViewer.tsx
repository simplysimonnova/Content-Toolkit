import React, { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, Info,
  RotateCcw, Download, ChevronDown, ChevronUp,
} from 'lucide-react';
import type {
  ToolReport,
  ReportSection,
  SummarySection,
  ScorecardSection,
  TableSection,
  DiffSection,
  TextSection,
  RawSection,
} from '../types/report';

// ── Status badge config — mirrors existing badge system ───────────────────────

const STATUS_CONFIG = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-100 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    Icon: CheckCircle2,
    label: 'Success',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-100 dark:border-red-800',
    dot: 'bg-red-500',
    Icon: XCircle,
    label: 'Error',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-800',
    dot: 'bg-amber-500',
    Icon: AlertTriangle,
    label: 'Warning',
  },
  info: {
    bg: 'bg-slate-50 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    Icon: Info,
    label: 'Info',
  },
} as const;

const VARIANT_BADGE: Record<string, string> = {
  success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  error:   'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  neutral: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
};

// ── Section renderers — renderer owns all layout ──────────────────────────────

function SummaryRenderer({ section }: { section: SummarySection }) {
  const cfg = STATUS_CONFIG[section.status] ?? STATUS_CONFIG.info;
  const { Icon } = cfg;
  return (
    <div className={`p-4 rounded-2xl border flex items-start gap-3 ${cfg.bg} ${cfg.border}`}>
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.text}`} />
      <div>
        {section.title && (
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${cfg.text}`}>
            {section.title}
          </p>
        )}
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {section.text}
        </p>
      </div>
    </div>
  );
}

function ScorecardRenderer({ section }: { section: ScorecardSection }) {
  return (
    <div>
      {section.title && (
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
          {section.title}
        </h4>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {section.items.map((item, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              {item.label}
            </p>
            <p className={`text-lg font-black ${item.variant ? VARIANT_BADGE[item.variant].split(' ').filter(c => c.startsWith('text')).join(' ') : 'text-slate-800 dark:text-white'}`}>
              {item.value}
            </p>
            {item.variant && (
              <span className={`mt-1 inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${VARIANT_BADGE[item.variant ?? 'neutral']}`}>
                {item.variant}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableRenderer({ section }: { section: TableSection }) {
  return (
    <div>
      {section.title && (
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
          {section.title}
        </h4>
      )}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-slate-700">
            <tr>
              {section.columns.map((col, i) => (
                <th key={i} className="px-4 py-3">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {section.rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                {section.columns.map((col, j) => (
                  <td key={j} className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                    {row[col] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiffRenderer({ section }: { section: DiffSection }) {
  return (
    <div>
      {section.title && (
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
          {section.title}
        </h4>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-2">Before</p>
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-4">
            <pre className="font-mono text-xs text-red-800 dark:text-red-300 whitespace-pre-wrap leading-relaxed">
              {section.before}
            </pre>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-2">After</p>
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4">
            <pre className="font-mono text-xs text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap leading-relaxed">
              {section.after}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextRenderer({ section }: { section: TextSection }) {
  return (
    <div>
      {section.title && (
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
          {section.title}
        </h4>
      )}
      <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-5 border border-slate-800 shadow-md">
        <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
          {section.content}
        </pre>
      </div>
    </div>
  );
}

function RawRenderer({ section }: { section: RawSection }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mb-2"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {section.title ?? 'Raw Data'}
      </button>
      {expanded && (
        <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-5 border border-slate-800 shadow-md">
          <pre className="font-mono text-xs text-slate-400 whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {JSON.stringify(section.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Section dispatcher ────────────────────────────────────────────────────────

function renderSection(section: ReportSection, index: number) {
  let inner: React.ReactElement | null = null;
  switch (section.type) {
    case 'summary':   inner = <SummaryRenderer   section={section} />; break;
    case 'scorecard': inner = <ScorecardRenderer section={section} />; break;
    case 'table':     inner = <TableRenderer     section={section} />; break;
    case 'diff':      inner = <DiffRenderer      section={section} />; break;
    case 'text':      inner = <TextRenderer      section={section} />; break;
    case 'raw':       inner = <RawRenderer       section={section} />; break;
    default:          return null;
  }
  return <div key={index}>{inner}</div>;
}

// ── ReportViewer props ────────────────────────────────────────────────────────

interface ReportViewerProps {
  report: ToolReport;
  /**
   * Optional: called when user clicks Re-run.
   * If not provided, the Re-run button is not shown.
   */
  onRerun?: () => void;
}

// ── Global header — identical across all tools, non-configurable ──────────────

function ReportHeader({
  report,
  onRerun,
  onExport,
}: {
  report: ToolReport;
  onRerun?: () => void;
  onExport: () => void;
}) {
  const statusCfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.info;

  const formattedDate = (() => {
    try {
      return new Date(report.created_at).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return report.created_at; }
  })();

  return (
    <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-slate-900 dark:text-white capitalize">
            {report.tool_id.replace(/-/g, ' ')}
          </h2>
          <span className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-400">{formattedDate}</p>
      </div>
      <div className="flex items-center gap-2">
        {onRerun && (
          <button
            onClick={onRerun}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Re-run
          </button>
        )}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all"
        >
          <Download className="w-3.5 h-3.5" /> Export JSON
        </button>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export const ReportViewer: React.FC<ReportViewerProps> = ({ report, onRerun }) => {
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${report.tool_id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden w-full max-w-3xl mx-auto">
      <ReportHeader report={report} onRerun={onRerun} onExport={handleExport} />
      <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
        {report.report_data.sections.map((section, i) => renderSection(section, i))}
      </div>
    </div>
  );
};
