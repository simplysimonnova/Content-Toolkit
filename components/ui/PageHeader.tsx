import React from 'react';
import { IconBadge } from './IconBadge';

interface PageHeaderProps {
  icon: React.ReactNode;
  iconColor?: 'indigo';
  title: string;
  description: string;
  actions?: React.ReactNode;
}

/**
 * PageHeader — shared page header card.
 *
 * Canonical pattern from ThematicQA / TNStandardiser headers.
 * Always uses IconBadge variant="solid" — never bare inline icons.
 *
 * Usage:
 *   <PageHeader
 *     icon={<ShieldCheck />}
 *     iconColor="indigo"
 *     title="Tool Name"
 *     description="Short subtitle"
 *     actions={<button ...>...</button>}
 *   />
 *
 * See UI_STYLE_GUIDE.md §2 for full usage rules.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  iconColor = 'indigo',
  title,
  description,
  actions,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        <IconBadge icon={icon} variant="solid" color={iconColor} />
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {description}
          </p>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};
