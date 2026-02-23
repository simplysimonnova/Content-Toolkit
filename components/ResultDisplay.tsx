
import React from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';

interface ResultDisplayProps {
  result: string | null;
  error: string | null;
  mode: 'content' | 'description';
  isLoading?: boolean;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, error, mode, isLoading }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const title = mode === 'content' ? 'Lesson Content Field' : 'Description Field';
  const subtitle = mode === 'content' 
    ? 'Format: Second Person (You will...)' 
    : 'Format: Third Person (Students will...)';
  
  const themeClasses = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700';
  const textClasses = 'text-slate-800 dark:text-slate-200';
  const buttonClasses = 'text-slate-600 bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-600 dark:hover:text-white';

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl shadow-sm border border-red-200 dark:border-red-800/50 mb-4 h-full transition-colors">
         <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5"/> Error: {title}
        </h2>
        <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
      </div>
    )
  }

  if (isLoading) {
     return (
      <div className={`p-6 rounded-xl shadow-sm border mb-4 flex flex-col h-full animate-pulse transition-colors ${themeClasses}`}>
        <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-slate-400/20 rounded w-1/2"></div>
            <div className="h-8 bg-slate-400/20 rounded-full w-24"></div>
        </div>
        <div className="bg-white/50 dark:bg-slate-800/50 p-6 rounded-lg flex-grow space-y-3">
             <div className="h-4 bg-slate-400/20 rounded w-full"></div>
             <div className="h-4 bg-slate-400/20 rounded w-5/6"></div>
             <div className="h-4 bg-slate-400/20 rounded w-4/5"></div>
             <div className="h-4 bg-slate-400/20 rounded w-full"></div>
        </div>
      </div>
     );
  }

  if (!result) return null;

  return (
    <div className={`p-6 rounded-xl shadow-sm border mb-4 flex flex-col transition-all h-full ${themeClasses}`}>
      <div className="flex justify-between items-center mb-4">
        <div>
            <h2 className={`text-lg font-semibold ${textClasses}`}>{title}</h2>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full transition-all ${buttonClasses}`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex-grow transition-colors">
        <p className="text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap">
          {result}
        </p>
      </div>
      
      <div className={`mt-2 text-xs opacity-70 text-right ${textClasses}`}>
        {subtitle}
      </div>
    </div>
  );
};
