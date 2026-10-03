/**
 * @file BedGrid.jsx
 * Grid of bed cells with a legend. Clicking an occupied bed opens PatientDetailPopup; an empty bed
 * opens BedInfoPanel.
 */

import React, { useState } from 'react';
import BedCell from './BedCell.jsx';
import PatientDetailPopup from './PatientDetailPopup.jsx';
import BedInfoPanel from './BedInfoPanel.jsx';

const LEGEND = [
  ['Available', 'bg-green-500'],
  ['Occupied', 'bg-royal-500'],
  ['Cleaning', 'bg-amber-500'],
  ['Maintenance', 'bg-gray-500'],
  ['Reserved', 'bg-purple-500'],
];

export function BedGrid({ beds = [], onSelectBed = null, columns = 'grid-cols-5 sm:grid-cols-6 md:grid-cols-8' }) {
  const [selectedBed, setSelectedBed] = useState(null);

  const handleClick = (bed) => {
    setSelectedBed(bed);
    if (onSelectBed && typeof onSelectBed === 'function') onSelectBed(bed);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid gap-2 ${columns}`}>
        {beds.filter(Boolean).map((bed) => (
          <BedCell key={bed.id} bed={bed} onBedClick={handleClick} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-cream-200 text-xs text-ink-500">
        {LEGEND.map(([label, cls]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded ${cls}`} /> {label}
          </span>
        ))}
      </div>

      {selectedBed && selectedBed.patient_id && (
        <PatientDetailPopup patientId={selectedBed.patient_id || null} bedInfo={selectedBed} onClose={() => setSelectedBed(null)} />
      )}
      {selectedBed && !selectedBed.patient_id && <BedInfoPanel bed={selectedBed} onClose={() => setSelectedBed(null)} />}
    </div>
  );
}

export default BedGrid;
