import React from 'react';

/**
 * StatusBadge component displays the overall status of a record with appropriate styling.
 * Props:
 *   status: string - one of 'approved', 'needs_review', 'needs_correction'
 */
export default function StatusBadge({ status }) {
  const config = {
    approved: {
      label: 'Human-verified & signed',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    needs_review: {
      label: 'AI-extracted - pending review',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    needs_correction: {
      label: 'Needs correction',
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
    },
  };
  const { label, bg, text, border } = config[status] || config.needs_review;
  return (
    <span className={`text-xs ${bg} ${text} ${border} px-2.5 py-0.5 rounded-full font-medium`}>✓ {label}</span>
  );
}
