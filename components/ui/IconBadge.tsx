import React from 'react';

type BadgeColor = 'indigo' | 'orange';
type BadgeVariant = 'solid' | 'tinted';

interface IconBadgeProps {
  icon: React.ReactNode;
  variant: BadgeVariant;
  color?: BadgeColor;
}

const SOLID_CLASSES: Record<BadgeColor, string> = {
  indigo: 'bg-indigo-600 shadow-lg shadow-indigo-500/20',
  orange: 'bg-orange-500 shadow-lg shadow-orange-500/20',
};

const TINTED_CLASSES: Record<BadgeColor, string> = {
  indigo: 'bg-indigo-50 dark:bg-indigo-900/30',
  orange: 'bg-orange-100 dark:bg-orange-900/30',
};

const TINTED_ICON_CLASSES: Record<BadgeColor, string> = {
  indigo: 'text-indigo-500',
  orange: 'text-orange-500',
};

/**
 * IconBadge — shared icon container.
 *
 * variant="solid"  — for page headers (p-4, colored bg, white icon, w-8 h-8)
 * variant="tinted" — for card items / list items (p-2, tinted bg, colored icon, w-5 h-5)
 *
 * See UI_STYLE_GUIDE.md §3 for usage rules.
 */
export const IconBadge: React.FC<IconBadgeProps> = ({ icon, variant, color = 'indigo' }) => {
  if (variant === 'solid') {
    return (
      <div className={`p-4 rounded-2xl flex-shrink-0 ${SOLID_CLASSES[color]}`}>
        <span className="block [&>svg]:w-8 [&>svg]:h-8 [&>svg]:text-white">
          {icon}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-2 rounded-xl flex-shrink-0 ${TINTED_CLASSES[color]}`}>
      <span className={`block [&>svg]:w-5 [&>svg]:h-5 ${TINTED_ICON_CLASSES[color]}`}>
        {icon}
      </span>
    </div>
  );
};
