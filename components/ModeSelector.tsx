
import React from 'react';
import { OutputMode } from '../types';
import { Users, Code } from 'lucide-react';

interface ModeSelectorProps {
  currentMode: OutputMode;
  onModeChange: (mode: OutputMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 transition-colors">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">1. Select Output Mode</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => onModeChange('content')}
          className={`relative p-4 rounded-lg border-2 text-left transition-all ${
            currentMode === 'content'
              ? 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-500/10'
              : 'border-slate-200 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-400/50 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full ${currentMode === 'content' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              <Users className="w-5 h-5" />
            </div>
            <span className={`font-semibold ${currentMode === 'content' ? 'text-orange-700 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>
              Lesson Content Field
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-10">
            Front-facing, engaging blurb for teachers, parents, and students ("You will...").
          </p>
        </button>

        <button
          onClick={() => onModeChange('description')}
          className={`relative p-4 rounded-lg border-2 text-left transition-all ${
            currentMode === 'description'
              ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10'
              : 'border-slate-200 dark:border-slate-700 hover:border-teal-200 dark:hover:border-teal-400/50 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full ${currentMode === 'description' ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              <Code className="w-5 h-5" />
            </div>
            <span className={`font-semibold ${currentMode === 'description' ? 'text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-300'}`}>
              Description Field
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-10">
            Technical description for LLM exercise generation ("Students will...").
          </p>
        </button>
      </div>
    </div>
  );
};
