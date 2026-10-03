/**
 * @file OtGantt.jsx
 * Operating Theatre timeline Gantt component displaying surgery durations, overruns, and turnover blocks.
 */

import React from 'react';
import clsx from 'clsx';
import { Clock, AlertTriangle, Sparkles, Activity } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

export function OtGantt({ otRooms = [], onSelectCase = null }) {
  // Convert hours 07:00 to 18:00 (11 hours total timeline)
  const startHour = 7;
  const endHour = 18;
  const totalHours = endHour - startHour;

  const parseTimeToPercent = (timeStr) => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    const hourVal = h + m / 60;
    const clamped = Math.max(startHour, Math.min(endHour, hourVal));
    return ((clamped - startHour) / totalHours) * 100;
  };

  const hoursMarks = Array.from({ length: totalHours + 1 }).map((_, i) => `${startHour + i}:00`);

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Time Header Ruler */}
      <div className="flex border-b border-surface-border pb-2 text-xs font-mono text-surface-muted pl-40">
        {hoursMarks.map((hr, idx) => (
          <div key={idx} className="flex-1 text-left relative">
            <span className="-ml-3">{hr}</span>
            <div className="absolute top-4 bottom-0 left-0 w-px h-2 bg-surface-border" />
          </div>
        ))}
      </div>

      {/* Room Lanes */}
      <div className="space-y-3">
        {otRooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center gap-3 p-2 bg-surface-sunken/40 rounded-xl border border-surface-border"
          >
            {/* Room Identifier */}
            <div className="w-36 shrink-0 flex flex-col">
              <span className="font-semibold text-xs text-surface-foreground truncate">
                {room.name.split('(')[0].trim()}
              </span>
              <span className="text-[11px] text-surface-muted truncate">
                {room.name.includes('(') ? room.name.split('(')[1].replace(')', '') : ''}
              </span>
              <div className="mt-1">
                <StatusBadge status={room.status} size="xs" />
              </div>
            </div>

            {/* Gantt Bar Runway */}
            <div className="flex-1 h-14 bg-surface-elevated rounded-lg relative overflow-hidden border border-surface-border">
              {/* Hour Grid Lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {hoursMarks.map((_, idx) => (
                  <div key={idx} className="flex-1 border-r border-surface-border/40 h-full" />
                ))}
              </div>

              {/* Scheduled Cases Blocks */}
              {room.schedule.map((slot) => {
                const isCleaning = slot.type === 'cleaning';
                const isEmergency = slot.type === 'emergency';
                const isOverrun = slot.isOverrun;

                const leftPct = parseTimeToPercent(slot.start);
                const rightPct = parseTimeToPercent(slot.end);
                const widthPct = Math.max(4, rightPct - leftPct);

                return (
                  <div
                    key={slot.id}
                    onClick={() => onSelectCase && onSelectCase(slot, room)}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                    title={`${slot.title} (${slot.start} - ${slot.end})`}
                    className={clsx(
                      'absolute top-1.5 bottom-1.5 rounded-md px-2 flex items-center justify-between text-xs font-medium transition-all shadow-xs cursor-pointer overflow-hidden border',
                      isCleaning
                        ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        : isEmergency
                        ? 'bg-danger-600 text-white border-danger-700 font-bold'
                        : isOverrun
                        ? 'bg-amber-600 text-white border-amber-700 animate-pulse'
                        : 'bg-primary-600 text-white border-primary-700'
                    )}
                  >
                    <span className="truncate flex items-center gap-1">
                      {isCleaning ? (
                        <Sparkles className="w-3 h-3 shrink-0" />
                      ) : isEmergency ? (
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                      ) : (
                        <Activity className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate">{slot.title}</span>
                    </span>
                    <span className="text-[11px] opacity-80 shrink-0 font-mono ml-1 hidden sm:inline">
                      {slot.start}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-surface-muted border-t border-surface-border">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary-600" /> Elective Case
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-danger-600" /> Emergency Procedure
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-600" /> Overrun Case (+30m)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-700" /> Turnover & Sterilization
        </span>
      </div>
    </div>
  );
}

export default OtGantt;
