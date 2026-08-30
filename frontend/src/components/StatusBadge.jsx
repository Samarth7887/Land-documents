import React from 'react';

/**
 * StatusBadge component displays the overall status of a record with appropriate styling.
 */
export default function StatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase();

  const config = {
    approved: {
      label: 'Approved',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    corrected: {
      label: 'Corrected',
      bg: 'bg-blue-500/10',
      text: 'text-blue-300',
      border: 'border-blue-500/30',
    },
    extracted: {
      label: 'Needs review',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    review: {
      label: 'Needs review',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    correction_needed: {
      label: 'Needs correction',
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
    },
    pending_approval: {
      label: 'Pending approval',
      bg: 'bg-sky-500/10',
      text: 'text-sky-400',
      border: 'border-sky-500/30',
    },
    failed: {
      label: 'Failed',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/30',
    },
  };

  const { label, bg, text, border } = config[normalized] || {
    label: 'Unknown',
    bg: 'bg-slate-800/70',
    text: 'text-slate-300',
    border: 'border-slate-700',
  };

  return (
    <span className={`text-xs ${bg} ${text} ${border} px-2.5 py-0.5 rounded-full font-medium`}>
      {label}
    </span>
  );
}
