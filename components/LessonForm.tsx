
import React from 'react';
import { LessonInfo } from '../types';

interface LessonFormProps {
  info: LessonInfo;
  onChange: (info: LessonInfo) => void;
  onSubmit: () => void;
  isGenerating: boolean;
}

export const LessonForm: React.FC<LessonFormProps> = ({ info, onChange, onSubmit, isGenerating }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChange({ ...info, [name]: value });
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">2. Lesson Details</h2>
      
      <div className="space-y-4 flex flex-col">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Target Age
          </label>
          <input
            type="text"
            name="age"
            value={info.age}
            onChange={handleChange}
            placeholder="e.g., 10+"
            className="w-full rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400 px-4 py-2 border transition-colors"
          />
        </div>

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Lesson Information
          </label>
          <textarea
            name="lessonDetails"
            value={info.lessonDetails}
            onChange={handleChange}
            placeholder="Paste your lesson details here. Include:
- Lesson Title / Theme
- Grammar Focus
- Vocabulary List
- Notes about Texts / Tasks
- VR / Digital Resources"
            className="w-full min-h-[300px] rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400 px-4 py-2 border resize-y font-mono text-sm transition-colors"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Paste the raw lesson data here. The AI will extract the relevant details.
          </p>
        </div>
      </div>

      <div className="pt-6 mt-2">
        <button
          onClick={onSubmit}
          disabled={isGenerating}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/20 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${
            isGenerating ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            'Generate Content'
          )}
        </button>
      </div>
    </div>
  );
};
