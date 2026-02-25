import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Eye, Tag, AlertTriangle } from 'lucide-react';
import { ThematicQAResult } from './types';

const RISK_CONFIG = {
  none:     { label: 'None',     bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-800',   text: 'text-green-700 dark:text-green-400',   dot: 'bg-green-500' },
  low:      { label: 'Low',      bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  moderate: { label: 'Moderate', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  high:     { label: 'High',     bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-700 dark:text-red-400',       dot: 'bg-red-500' },
};

export { RISK_CONFIG };

interface ResultPanelProps {
  result: ThematicQAResult;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ result }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({ keywords: true, text: true, visual: true });
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));
  const riskCfg = RISK_CONFIG[result.risk_level] ?? RISK_CONFIG.none;
  const totalKw = Object.values(result.generated_keywords).flat().length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Risk Banner */}
      <div className={`p-6 rounded-3xl border ${riskCfg.bg} ${riskCfg.border} flex items-center justify-between flex-wrap gap-4`}>
        <div className="flex items-center gap-4">
          <div className={`w-4 h-4 rounded-full ${riskCfg.dot} shrink-0`} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Risk Level</span>
              <span className={`text-lg font-black uppercase ${riskCfg.text}`}>{riskCfg.label}</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{result.summary}</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400 space-y-0.5 shrink-0">
          <div><span className="font-bold text-slate-600 dark:text-slate-300">{result.text_matches.length}</span> text match{result.text_matches.length !== 1 ? 'es' : ''}</div>
          <div><span className="font-bold text-slate-600 dark:text-slate-300">{result.visual_matches.length}</span> visual match{result.visual_matches.length !== 1 ? 'es' : ''}</div>
          <div><span className="font-bold text-slate-600 dark:text-slate-300">{totalKw}</span> keywords</div>
        </div>
      </div>

      {/* Keywords */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <button className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => toggle('keywords')}>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-500" />Generated Keywords
            <span className="text-xs font-normal text-slate-400">({totalKw} total)</span>
          </span>
          {open.keywords ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>
        {open.keywords && (
          <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            {(Object.entries(result.generated_keywords) as [string, string[]][]).map(([cat, terms]) =>
              terms.length > 0 && (
                <div key={cat}>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">{cat.replace(/_/g, ' ')}</p>
                  <div className="flex flex-wrap gap-1">
                    {terms.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono rounded-md">{t}</span>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Text Matches */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <button className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => toggle('text')}>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />Text Matches
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${result.text_matches.length > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>{result.text_matches.length}</span>
          </span>
          {open.text ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>
        {open.text && (
          <div className="border-t border-slate-100 dark:border-slate-700">
            {result.text_matches.length === 0
              ? <p className="px-5 py-4 text-sm text-slate-400 italic">No text matches found.</p>
              : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider w-16">Slide</th>
                      <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider w-32">Matched Term</th>
                      <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.text_matches.map((m, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-4 py-3 font-mono text-slate-500">{m.slide}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold rounded">{m.matched_term}</span></td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 leading-relaxed">{m.context}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        )}
      </div>

      {/* Visual Matches */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <button className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => toggle('visual')}>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-500" />Visual Matches
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${result.visual_matches.length > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>{result.visual_matches.length}</span>
          </span>
          {open.visual ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>
        {open.visual && (
          <div className="border-t border-slate-100 dark:border-slate-700">
            {result.visual_matches.length === 0
              ? <p className="px-5 py-4 text-sm text-slate-400 italic">No visual matches found.</p>
              : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider w-16">Slide</th>
                      <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Matched Element</th>
                      <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider w-24">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.visual_matches.map((m, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-4 py-3 font-mono text-slate-500">{m.slide}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{m.matched_element}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold rounded text-[10px] uppercase">{m.confidence}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        )}
      </div>

      {/* Raw JSON */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <button className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => toggle('json')}>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-slate-400" />Raw JSON Report</span>
          {open.json ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>
        {open.json && (
          <div className="border-t border-slate-100 dark:border-slate-700 p-4">
            <pre className="text-[10px] font-mono text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
