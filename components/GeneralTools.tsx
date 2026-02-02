
import React, { useState } from 'react';
import { SpreadsheetDeduplicator } from './SpreadsheetDeduplicator';
import { ShieldBan } from 'lucide-react';

export const GeneralTools: React.FC = () => {
  const [activeTool, setActiveTool] = useState<'deduplicator'>('deduplicator');

  return (
    <div className="max-w-6xl mx-auto">
      {/* Tool Switcher */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-200/60 dark:bg-slate-800 p-1.5 rounded-xl inline-flex items-center shadow-inner dark:shadow-none dark:border dark:border-slate-700 transition-colors">
          <button
            onClick={() => setActiveTool('deduplicator')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTool === 'deduplicator'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <ShieldBan className="w-4 h-4" />
            Spreadsheet De-duplication
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="transition-opacity duration-300 ease-in-out">
        {activeTool === 'deduplicator' && <SpreadsheetDeduplicator />}
      </div>
    </div>
  );
};
