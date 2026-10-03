/**
 * @file Tabs.jsx
 * Accessible tab navigation switch component with badge indicators and pill or line variants.
 */

import React from 'react';
import clsx from 'clsx';

export function Tabs({
  tabs = [], // [{ id, label, count, icon: Icon }]
  activeTab,
  onChange,
  variant = 'pills', // 'pills' | 'underline'
  className = '',
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 overflow-x-auto select-none no-scrollbar',
        variant === 'underline'
          ? 'border-b border-surface-border gap-6'
          : 'p-1 bg-surface-sunken rounded-xl border border-surface-border',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={clsx(
                'relative pb-3 pt-1 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer border-b-2',
                isActive
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-surface-muted hover:text-surface-foreground'
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={clsx(
                    'text-[10px] font-mono px-1.5 py-0.5 rounded-full',
                    isActive
                      ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                      : 'bg-surface-sunken text-surface-muted'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap',
              isActive
                ? 'bg-surface-elevated text-surface-foreground shadow-xs border border-surface-border font-semibold'
                : 'text-surface-muted hover:text-surface-foreground hover:bg-surface-elevated/40'
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                  isActive
                    ? 'bg-primary-500 text-white font-bold'
                    : 'bg-surface-elevated text-surface-muted'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
