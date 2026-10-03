/**
 * @file EquipmentCard.jsx
 * Biomedical asset card with battery level gauge, maintenance indicators, and location tags.
 */

import React from 'react';
import clsx from 'clsx';
import {
  Battery,
  BatteryWarning,
  Activity,
  Wrench,
  MapPin,
  Stethoscope,
} from 'lucide-react';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Badge from '../ui/Badge.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';

export function EquipmentCard({ equipment, onClick = null }) {
  if (!equipment) return null;

  const isLowBattery = equipment.batteryPercentage <= 20;

  return (
    <Card
      onClick={() => onClick && onClick(equipment)}
      hoverable={!!onClick}
      className={clsx(
        'p-4 transition-all',
        equipment.isWarning && 'border-l-4 border-l-amber-500'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <h4 className="font-semibold text-xs text-surface-foreground truncate">
              {equipment.name}
            </h4>
            <span className="font-mono text-[10px] text-surface-muted">
              {equipment.assetTag}
            </span>
          </div>
        </div>

        <StatusBadge status={equipment.status} size="xs" />
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-xs text-surface-muted my-2">
        <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" />
        <span className="truncate">{equipment.location} ({equipment.department})</span>
      </div>

      {/* Battery and Maintenance */}
      <div className="pt-2 border-t border-surface-border flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-[11px] text-surface-muted">
            {isLowBattery ? (
              <BatteryWarning className="w-3.5 h-3.5 text-danger-500 animate-pulse" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-emerald-500" />
            )}
            Battery Level
          </span>
          <span className={clsx('font-mono font-bold text-xs', isLowBattery ? 'text-danger-500' : 'text-surface-foreground')}>
            {equipment.batteryPercentage}%
          </span>
        </div>

        <ProgressBar
          value={equipment.batteryPercentage}
          autoColor={false}
          color={isLowBattery ? 'danger' : 'success'}
          size="sm"
        />

        {equipment.maintenanceDueDate && (
          <div className="flex items-center justify-between text-[10px] text-surface-muted font-mono pt-1">
            <span>Next Inspection</span>
            <span>{equipment.maintenanceDueDate}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export default EquipmentCard;
