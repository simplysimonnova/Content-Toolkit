
import React from 'react';
import { Timer, Construction, Sparkles } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors animate-fade-in">
      <div className="relative mb-6">
        <div className="relative p-6 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
          <Construction className="w-12 h-12" />
        </div>
      </div>
      
      <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight">
        {title}
      </h2>
      
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-8 font-medium">
        <Timer className="w-4 h-4" />
        <span>This tool is coming soon!</span>
      </div>
      
      <p className="max-w-md text-center text-slate-500 dark:text-slate-400 leading-relaxed">
        Our engineering team is currently building this feature to help streamline your content workflow. 
        Check back shortly for the beta release.
      </p>
    </div>
  );
};
