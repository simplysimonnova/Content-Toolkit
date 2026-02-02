
import React, { useState } from 'react';
import { WordListProcessor } from './WordListProcessor';
import { TopicAssigner } from './TopicAssigner';
import { ListFilter, Tag, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ToolSettingsModal } from './ToolSettingsModal';
import { TOPIC_RULES } from '../constants/toolRules';

export const LLMTools: React.FC = () => {
  const { isAdmin } = useAuth();
  const [activeTool, setActiveTool] = useState<'cleaner' | 'topics'>('cleaner');
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tool Header */}
      <div className="mb-8 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
        <div className="bg-slate-200/60 dark:bg-slate-800 p-1.5 rounded-xl inline-flex items-center shadow-inner dark:shadow-none dark:border dark:border-slate-700 transition-colors">
          <button
            onClick={() => setActiveTool('cleaner')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTool === 'cleaner'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            Word List Cleaner
          </button>
          <button
            onClick={() => setActiveTool('topics')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTool === 'topics'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Tag className="w-4 h-4" />
            Topic Assigner
          </button>
        </div>
        {isAdmin && (
          <button onClick={() => setShowSettings(true)} className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-700 rounded-xl transition-all">
             <Settings className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="transition-opacity duration-300 ease-in-out">
        {activeTool === 'cleaner' ? <WordListProcessor /> : <TopicAssigner />}
      </div>

      <ToolSettingsModal 
        toolId={activeTool === 'cleaner' ? "word-cleaner" : "topic-assigner"} 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        defaultPrompt={activeTool === 'cleaner' ? "Follow word cleaning rules." : JSON.stringify(TOPIC_RULES)} 
      />
    </div>
  );
};