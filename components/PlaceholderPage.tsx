
import React from 'react';
import { Timer, Construction, Sparkles } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 transition-colors animate-fade-in">
      <div className="relative mb-6">
        <div className="absolute -inset-1 bg-orange-500 rounded-full blur opacity-25 animate-pulse"></div>
        <div className="relative p-6 bg-orange-50 dark:bg-orange-900/20 rounded-full text-orange-500">
          <Construction className="w-12 h-12" />
        </div>
        <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-orange-400 animate-bounce" />
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
