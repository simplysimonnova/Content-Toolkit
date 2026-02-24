import React, { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, AlertCircle, XCircle,
  Star, Lightbulb, BarChart3, FileText, Zap,
  ChevronDown, ChevronUp, Eye, EyeOff, Send
} from 'lucide-react';
import type { QARun, QAIssue } from './types';
import { QA_MODE_LABELS } from './types';
import { pushToConnector } from '../../services/connectorInterface';
import { useAuth } from '../../context/AuthContext';

const VERDICT_CONFIG = {
  'pass': {
    label: 'Pass',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  'pass-with-warnings': {
    label: 'Pass with Warnings',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    bar: 'bg-amber-500',
    icon: AlertTriangle,
  },
  'revision-required': {
    label: 'Revision Required',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-400',
    bar: 'bg-orange-500',
    icon: AlertCircle,
  },
  'fail': {
    label: 'Fail',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-500',
    icon: XCircle,
  },
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  major: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400',
  minor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
};

const Collapsible: React.FC<{
  title: string;
  count?: number;
  accent: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, count, accent, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-5 rounded-full ${accent}`} />
          <span className="font-bold text-sm text-slate-800 dark:text-white">{title}</span>
          {count !== undefined && (
            <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
};

interface Props {
  result: QARun;
  runId: string;
  onReset: () => void;
}

export const ResultDisplay: React.FC<Props> = ({ result, runId, onReset }) => {
  const { isAdmin } = useAuth();
  const [showRaw, setShowRaw] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const cfg = VERDICT_CONFIG[result.verdict];
  const VerdictIcon = cfg.icon;

  const handlePush = async () => {
    setPushStatus('Pushing…');
    try {
      const res = await pushToConnector('project-tool', result, runId);
      setPushStatus(res.message);
    } catch (e: any) {
      setPushStatus(`Push failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Verdict card */}
      <div className={`p-6 rounded-3xl border-2 ${cfg.bg} ${cfg.border} shadow-sm`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 ${cfg.bar} rounded-2xl text-white shadow-lg`}>
              <VerdictIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.text} ${cfg.border} bg-white/50 dark:bg-black/10`}>
                  {cfg.label}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {QA_MODE_LABELS[result.mode]}
                </span>
                <span className="text-[10px] font-mono text-slate-400">v:{result.prompt_version}</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{result.title}</h2>
              <p className={`text-sm font-medium mt-1 ${cfg.text}`}>{result.short_summary}</p>
            </div>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <span className={`text-5xl font-black ${cfg.text}`}>{result.total_score}</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">/ 100</span>
          </div>
        </div>

        {/* Score bars */}
        {result.structured_scores.length > 0 && (
          <div className="mt-6 space-y-2">
            {result.structured_scores.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 w-44 shrink-0 truncate">{s.category}</span>
                <div className="flex-1 bg-white/60 dark:bg-black/20 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${cfg.bar}`}
                    style={{ width: `${Math.round((s.score / Math.max(s.maxScore, 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-slate-500 w-12 text-right shrink-0">{s.score}/{s.maxScore}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Slides', value: result.normalized_slide_count, icon: FileText },
          { label: 'Notes Found', value: result.notes_detected_count, icon: BarChart3 },
          { label: 'Exec Time', value: `${(result.execution_time_ms / 1000).toFixed(1)}s`, icon: Zap },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <stat.icon className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="text-lg font-black text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Deterministic flags */}
      {result.deterministic_flags.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">Pre-Check Warnings</p>
          <ul className="space-y-1.5">
            {result.deterministic_flags.map((f, i) => (
              <li key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Revision triggers */}
      {result.revision_required && result.revision_triggers.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl p-5">
          <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3">Revision Triggers</p>
          <ul className="space-y-1.5">
            {result.revision_triggers.map((t, i) => (
              <li key={i} className="text-sm text-orange-700 dark:text-orange-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expandable sections */}
      <Collapsible title="Strengths" count={result.full_report.strengths.length} accent="bg-emerald-500" defaultOpen>
        {result.full_report.strengths.length === 0
          ? <p className="text-sm text-slate-400 pt-2">No strengths noted.</p>
          : <ul className="pt-2 space-y-2">
              {result.full_report.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Star className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{s}
                </li>
              ))}
            </ul>
        }
      </Collapsible>

      <Collapsible title="Issues" count={result.full_report.issues.length} accent="bg-red-500" defaultOpen>
        {result.full_report.issues.length === 0
          ? <p className="text-sm text-slate-400 pt-2">No issues found.</p>
          : <div className="pt-2 space-y-3">
              {result.full_report.issues.map((issue: QAIssue, i: number) => (
                <div key={i} className={`p-3 rounded-xl border text-sm ${SEVERITY_STYLE[issue.severity] || ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{issue.severity}</span>
                    {issue.slideNumber != null && (
                      <span className="text-[9px] font-mono opacity-60">Slide {issue.slideNumber}</span>
                    )}
                  </div>
                  <p className="font-semibold">{issue.description}</p>
                  <p className="opacity-75 mt-1 text-[12px]">→ {issue.suggestion}</p>
                </div>
              ))}
            </div>
        }
      </Collapsible>

      <Collapsible title="Risks" count={result.full_report.risks.length} accent="bg-orange-500">
        {result.full_report.risks.length === 0
          ? <p className="text-sm text-slate-400 pt-2">No risks identified.</p>
          : <ul className="pt-2 space-y-2">
              {result.full_report.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />{r}
                </li>
              ))}
            </ul>
        }
      </Collapsible>

      <Collapsible title="Suggestions" count={result.full_report.suggestions.length} accent="bg-indigo-500">
        {result.full_report.suggestions.length === 0
          ? <p className="text-sm text-slate-400 pt-2">No suggestions.</p>
          : <ul className="pt-2 space-y-2">
              {result.full_report.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Lightbulb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />{s}
                </li>
              ))}
            </ul>
        }
      </Collapsible>

      {/* Admin: raw AI response */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <button
            onClick={() => setShowRaw(v => !v)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {showRaw ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {showRaw ? 'Hide' : 'View'} Raw AI Response
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Only</span>
          </button>
          {showRaw && (
            <div className="border-t border-slate-100 dark:border-slate-800 p-4">
              <pre className="text-xs font-mono bg-slate-950 text-emerald-400 p-4 rounded-xl max-h-80 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(result.parsed_ai_json, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-all"
        >
          Run Another QA
        </button>
        <button
          onClick={handlePush}
          disabled={!!pushStatus}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {pushStatus || 'Push Results to Project Tool'}
        </button>
      </div>

      <p className="text-center text-[10px] text-slate-400 font-mono">Run ID: {runId}</p>
    </div>
  );
};
