import React, { useState, useEffect } from 'react';
import { BarChart2, Search, Filter, Download, Eye, X, ChevronDown, Loader2, AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { fetchReports, ReportFilter } from './firebaseService';
import { ScanReport } from './types';
import { Timestamp } from 'firebase/firestore';

const RISK_CONFIG = {
  none:     { label: 'None',     bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  dot: 'bg-green-500' },
  low:      { label: 'Low',      bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  moderate: { label: 'Moderate', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  high:     { label: 'High',     bg: 'bg-red-100 dark:bg-red-900/30',      text: 'text-red-700 dark:text-red-400',      dot: 'bg-red-500' },
};

function formatDate(ts: any): string {
  if (!ts) return '—';
  try {
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

interface DetailModalProps {
  report: ScanReport;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ report, onClose }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tqa-report-${report.id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const risk = RISK_CONFIG[report.risk_level] ?? RISK_CONFIG.none;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white truncate max-w-md">{report.file_name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(report.created_at)} · Theme: <strong>{report.theme}</strong></p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Summary */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${risk.bg}`}>
            <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${risk.dot}`} />
            <div>
              <p className={`text-xs font-black uppercase tracking-widest mb-1 ${risk.text}`}>Risk: {risk.label}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{report.summary}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Text Matches', val: report.text_match_count },
              { label: 'Visual Matches', val: report.visual_match_count },
              { label: 'Processing Time', val: `${(report.processing_time_ms / 1000).toFixed(1)}s` },
            ].map(({ label, val }) => (
              <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700">
                <p className="text-lg font-black text-slate-900 dark:text-white">{val}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Text matches */}
          {report.text_matches.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Text Matches</p>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-slate-400 tracking-wider w-14">Slide</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-slate-400 tracking-wider w-28">Term</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-slate-400 tracking-wider">Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {report.text_matches.map((m, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-slate-500">{m.slide}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-bold">{m.matched_term}</span></td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{m.context}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Visual matches */}
          {report.visual_matches.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Visual Matches</p>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-slate-400 tracking-wider w-14">Slide</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-slate-400 tracking-wider">Element</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase text-slate-400 tracking-wider w-24">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {report.visual_matches.map((m, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-slate-500">{m.slide}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{m.matched_element}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-bold text-[10px] uppercase">{m.confidence}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Raw JSON */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Raw JSON</p>
            <pre className="text-[10px] font-mono text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 max-h-64">
              {JSON.stringify(report, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReportsDashboard: React.FC = () => {
  const [reports, setReports] = useState<ScanReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScanReport | null>(null);

  const [themeFilter, setThemeFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'none' | 'low' | 'moderate' | 'high'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReports({
        theme: themeFilter || undefined,
        risk_level: riskFilter,
        dateFrom: dateFrom ? new Date(dateFrom) : null,
        dateTo: dateTo ? new Date(dateTo) : null,
      });
      setReports(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const clearFilters = () => {
    setThemeFilter('');
    setRiskFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tqa-reports-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
            <BarChart2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">QA Reports</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Historical thematic scan results</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportAll} disabled={reports.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="w-3.5 h-3.5" /> Export All
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={themeFilter}
            onChange={e => setThemeFilter(e.target.value)}
            placeholder="Filter by theme…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select
            value={riskFilter}
            onChange={e => setRiskFilter(e.target.value as any)}
            className="pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
          >
            <option value="all">All Risk Levels</option>
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <span className="text-slate-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <button onClick={load} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-500/20">
          Apply
        </button>
        <button onClick={clearFilters} className="px-4 py-2 text-slate-400 hover:text-red-500 text-xs font-medium transition-colors">
          Clear
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">Loading reports…</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FileText className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">No reports found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{reports.length} report{reports.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Theme</th>
                    <th className="px-5 py-3">File</th>
                    <th className="px-5 py-3">Risk</th>
                    <th className="px-5 py-3">Matches</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {reports.map(r => {
                    const rc = RISK_CONFIG[r.risk_level] ?? RISK_CONFIG.none;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">{formatDate(r.created_at)}</td>
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200 max-w-[120px] truncate">{r.theme}</td>
                        <td className="px-5 py-3 text-xs text-slate-500 max-w-[180px] truncate">{r.file_name}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${rc.bg} ${rc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                            {rc.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{r.text_match_count + r.visual_match_count}</span>
                          <span className="text-slate-400 ml-1">({r.text_match_count}t / {r.visual_match_count}v)</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${r.status === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setSelected(r)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 text-xs font-bold transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selected && <DetailModal report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};
