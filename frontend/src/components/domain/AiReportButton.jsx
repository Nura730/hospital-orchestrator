/**
 * @file AiReportButton.jsx
 * Opens the explainable AI report popup for a scope (admin | doctor | ot).
 */

import React, { useState } from 'react';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import AiReportPopup from './AiReportPopup.jsx';

export function AiReportButton({ scope = 'admin', label = 'AI Report', defaultFormat = 'explain', variant = 'primary', className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(variant === 'primary' ? 'flow-btn-primary' : 'flow-btn-secondary', className)}
      >
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> {label}
      </button>
      {open && <AiReportPopup open={open} onClose={() => setOpen(false)} scope={scope} defaultFormat={defaultFormat} />}
    </>
  );
}

export default AiReportButton;
