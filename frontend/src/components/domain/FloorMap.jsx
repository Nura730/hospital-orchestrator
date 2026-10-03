/**
 * @file FloorMap.jsx
 * Native SVG Hospital Digital Twin Floor Map.
 * Renders department zones, patient flow directional arrows, live occupancy tier fills,
 * and +2h predictive forecast simulation recoloring.
 */

import React from 'react';
import clsx from 'clsx';
import { useTheme } from '../../hooks/useTheme.js';

export function FloorMap({
  beds = [],
  forecastMode = false,
  selectedDepartment = null,
  onSelectDepartment = null,
}) {
  const { isDark } = useTheme();

  // Calculate live occupancy per department
  const getOccupancy = (dept) => {
    const deptBeds = beds.filter((b) => b.department.toLowerCase() === dept.toLowerCase());
    const total = deptBeds.length || 1;
    const occupied = deptBeds.filter((b) => b.status === 'occupied').length;
    let pct = Math.round((occupied / total) * 100);

    // If in +2h predicted mode, simulate forecast drift
    if (forecastMode) {
      if (dept === 'ICU') pct = Math.min(100, pct + 8);
      else if (dept === 'Emergency') pct = Math.min(100, pct + 12);
      else if (dept === 'General Ward') pct = Math.min(100, pct + 5);
    }

    return { total: deptBeds.length, occupied, pct };
  };

  const getTierColor = (pct, isSelected) => {
    if (isSelected) return isDark ? '#0f766e' : '#014BAA'; // Selected teal
    if (pct >= 90) return isDark ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.25)'; // Danger Red
    if (pct >= 70) return isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.22)'; // Warning Amber
    return isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.2)'; // Normal Green
  };

  const getStrokeColor = (pct, isSelected) => {
    if (isSelected) return '#014BAA';
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    return '#10b981';
  };

  const departments = [
    { id: 'Emergency', label: 'Emergency (ER)', x: 40, y: 40, width: 220, height: 160 },
    { id: 'Radiology', label: 'Radiology & Imaging', x: 280, y: 40, width: 200, height: 160 },
    { id: 'OT', label: 'Operating Theatres (OT)', x: 500, y: 40, width: 260, height: 160 },
    { id: 'General Ward', label: 'General Medicine Ward', x: 40, y: 240, width: 260, height: 190 },
    { id: 'HDU', label: 'High Dependency (HDU)', x: 320, y: 240, width: 200, height: 190 },
    { id: 'ICU', label: 'Intensive Care Unit (ICU)', x: 540, y: 240, width: 220, height: 190 },
    { id: 'Isolation', label: 'Isolation Ward', x: 780, y: 140, width: 140, height: 200 },
  ];

  return (
    <div className="w-full relative bg-surface-sunken/40 rounded-2xl border border-surface-border p-4 overflow-hidden">
      <svg
        viewBox="0 0 960 470"
        className="w-full h-auto max-h-[560px] select-none"
      >
        <defs>
          {/* Arrowhead marker */}
          <marker
            id="flow-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill={isDark ? '#38bdf8' : '#0284c7'} />
          </marker>

          {/* Grid pattern */}
          <pattern id="twin-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke={isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.7)'}
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Blueprint background grid */}
        <rect width="960" height="470" fill="url(#twin-grid)" rx="16" />

        {/* Patient Flow Connecting Pathways / Arrows */}
        <g stroke={isDark ? '#38bdf8' : '#0284c7'} strokeWidth="2" strokeDasharray="6,4" fill="none" opacity="0.6">
          {/* ER -> Radiology */}
          <path d="M 260 110 L 280 110" markerEnd="url(#flow-arrow)" />
          {/* ER -> General Ward */}
          <path d="M 150 200 L 150 240" markerEnd="url(#flow-arrow)" />
          {/* ER -> ICU */}
          <path d="M 260 170 Q 400 190 540 290" markerEnd="url(#flow-arrow)" />
          {/* OT -> HDU */}
          <path d="M 540 200 L 480 240" markerEnd="url(#flow-arrow)" />
          {/* OT -> ICU */}
          <path d="M 640 200 L 640 240" markerEnd="url(#flow-arrow)" />
          {/* HDU -> Isolation */}
          <path d="M 760 310 L 780 300" markerEnd="url(#flow-arrow)" />
        </g>

        {/* Department Block Zones */}
        {departments.map((dept) => {
          const occ = getOccupancy(dept.id);
          const isSelected = selectedDepartment === dept.id;
          const fillColor = getTierColor(occ.pct, isSelected);
          const strokeColor = getStrokeColor(occ.pct, isSelected);

          return (
            <g
              key={dept.id}
              onClick={() => onSelectDepartment && onSelectDepartment(dept.id)}
              className="cursor-pointer group transition-all duration-200"
            >
              {/* Room Rectangle */}
              <rect
                x={dept.x}
                y={dept.y}
                width={dept.width}
                height={dept.height}
                rx="12"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? '3' : '1.5'}
                className="transition-colors duration-200"
              />

              {/* Department Name */}
              <text
                x={dept.x + 14}
                y={dept.y + 26}
                fill={isDark ? '#f8fafc' : '#0f172a'}
                fontSize="12"
                fontWeight="700"
                className="font-sans tracking-tight"
              >
                {dept.label}
              </text>

              {/* Occupancy Readout */}
              <text
                x={dept.x + 14}
                y={dept.y + 54}
                fill={strokeColor}
                fontSize="24"
                fontWeight="800"
                fontFamily="monospace"
              >
                {occ.pct}%
              </text>

              <text
                x={dept.x + 14}
                y={dept.y + 74}
                fill={isDark ? '#94a3b8' : '#64748b'}
                fontSize="11"
                fontWeight="500"
              >
                {occ.occupied} / {occ.total} Beds Occupied
              </text>

              {/* Status Pill */}
              <g transform={`translate(${dept.x + dept.width - 66}, ${dept.y + 12})`}>
                <rect
                  width="54"
                  height="18"
                  rx="9"
                  fill={strokeColor}
                  opacity="0.9"
                />
                <text
                  x="27"
                  y="12"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {occ.pct >= 90 ? 'CRITICAL' : occ.pct >= 70 ? 'WARNING' : 'NORMAL'}
                </text>
              </g>

              {/* Visual Mini Bed Matrix Indicator */}
              <g transform={`translate(${dept.x + 14}, ${dept.y + dept.height - 35})`}>
                {Array.from({ length: Math.min(10, occ.total || 8) }).map((_, i) => (
                  <circle
                    key={i}
                    cx={i * 12}
                    cy="6"
                    r="3.5"
                    fill={i < Math.round((occ.pct / 100) * 10) ? strokeColor : isDark ? '#334155' : '#cbd5e1'}
                  />
                ))}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default FloorMap;
