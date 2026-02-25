import React, { useEffect } from 'react';
import { X, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { QASettings, DEFAULT_SETTINGS } from './types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: QASettings;
  onChange: (s: QASettings) => void;
}

const STORAGE_KEY = 'tqa_settings';

export function loadSettings(): QASettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function persistSettings(s: QASettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onChange }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const set = (partial: Partial<QASettings>) => {
    const next = { ...settings, ...partial };
    onChange(next);
    persistSettings(next);
  };

  const Toggle: React.FC<{ value: boolean; onToggle: () => void }> = ({ value, onToggle }) => (
    <button onClick={onToggle} className="text-indigo-600 dark:text-indigo-400 transition-colors shrink-0">
      {value
        ? <ToggleRight className="w-7 h-7" />
        : <ToggleLeft className="w-7 h-7 text-slate-300 dark:text-slate-600" />}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Scanner Settings</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Strict Mode */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Strict Mode</p>
              <p className="text-xs text-slate-400 mt-0.5">Escalates ambiguous matches to moderate risk</p>
            </div>
            <Toggle value={settings.strictMode} onToggle={() => set({ strictMode: !settings.strictMode })} />
          </div>

          {/* Max Keywords */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Max Keyword Generation</p>
                <p className="text-xs text-slate-400 mt-0.5">Total keywords generated per scan</p>
              </div>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{settings.maxKeywords}</span>
            </div>
            <input
              type="range"
              min={20}
              max={120}
              step={10}
              value={settings.maxKeywords}
              onChange={e => set({ maxKeywords: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>20</span><span>60 (default)</span><span>120</span>
            </div>
          </div>

          {/* Visual Sensitivity */}
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Visual Sensitivity</p>
            <p className="text-xs text-slate-400 mb-3">Controls how aggressively AI flags visual content</p>
            <div className="flex gap-2">
              {(['conservative', 'balanced', 'aggressive'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => set({ visualSensitivity: v })}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    settings.visualSensitivity === v
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Save Reports Automatically */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Save Reports Automatically</p>
              <p className="text-xs text-slate-400 mt-0.5">Save each scan result to Firestore on completion</p>
            </div>
            <Toggle value={settings.saveReportsAutomatically} onToggle={() => set({ saveReportsAutomatically: !settings.saveReportsAutomatically })} />
          </div>

          {/* Firebase Logging */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Firebase Logging</p>
              <p className="text-xs text-slate-400 mt-0.5">Log usage events to Firestore</p>
            </div>
            <Toggle value={settings.firebaseLoggingEnabled} onToggle={() => set({ firebaseLoggingEnabled: !settings.firebaseLoggingEnabled })} />
          </div>

          {/* Default Theme */}
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Default Theme</p>
            <p className="text-xs text-slate-400 mb-2">Pre-fills the theme field on load (optional)</p>
            <input
              type="text"
              value={settings.defaultTheme}
              onChange={e => set({ defaultTheme: e.target.value })}
              placeholder="e.g. violence, gambling..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Batch Parallelism — future flag, disabled */}
          <div className="flex items-center justify-between gap-4 opacity-40 pointer-events-none select-none">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Batch Parallelism</p>
              <p className="text-xs text-slate-400 mt-0.5">Process multiple files simultaneously (coming soon)</p>
            </div>
            <ToggleLeft className="w-7 h-7 text-slate-300 dark:text-slate-600 shrink-0" />
          </div>

          {/* Reset */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => { onChange({ ...DEFAULT_SETTINGS }); persistSettings({ ...DEFAULT_SETTINGS }); }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
