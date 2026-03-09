import React from 'react';

interface Props {
  text: string;
}

/**
 * Renders standardised teacher notes output with styled slide headers.
 * Slide headers (e.g. "Slide 3") and "Teacher Notes:" labels get distinct treatment.
 */
export const ResultRenderer: React.FC<Props> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const isSlideHeader = /^Slide \d+$/i.test(trimmed);
        const isTNHeader = /^Teacher Notes:$/i.test(trimmed);

        if (isSlideHeader) {
          return (
            <div key={i} className="mt-8 mb-2 first:mt-0">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-indigo-100 dark:border-indigo-800/50 pb-1">
                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] tracking-normal font-bold">
                  SLIDE
                </span>
                {trimmed.replace(/Slide/gi, '').trim()}
              </h3>
            </div>
          );
        }

        if (isTNHeader) {
          return (
            <p key={i} className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 mt-2">
              {trimmed}
            </p>
          );
        }

        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }

        return (
          <p key={i} className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
};
