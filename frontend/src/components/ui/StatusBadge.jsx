// src/components/ui/StatusBadge.jsx
import React from 'react';

/**
 * Renders a badge based on a record status.
 * Expected status values: 'approved', 'needs_review', 'needs_correction', 'auto_approved', etc.
 */
export default function StatusBadge({ status }) {
  const map = {
    approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    needs_review: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    needs_correction: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    auto_approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    pending: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  };
  const classes = map[status] || 'bg-gray-200 text-gray-700 border-gray-300';
  const label = status.replace('_', ' ');
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${classes} font-medium`}>
      {label}
    </span>
  );
}
