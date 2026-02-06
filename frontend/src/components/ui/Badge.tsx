import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'gray' | 'red' | 'amber' | 'emerald' | 'indigo' | 'violet' | 'blue';
  className?: string;
}

const colorClasses: Record<NonNullable<BadgeProps['color']>, string> = {
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  red: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  violet: 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

const Badge: React.FC<BadgeProps> = ({
  children,
  color = 'gray',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses[color]} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
