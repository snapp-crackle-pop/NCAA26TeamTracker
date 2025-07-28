'use client';
import * as React from 'react';

type ViewMode = 'starters' | 'backups' | 'weighted';

export function ViewMenu({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const options: ViewMode[] = ['starters', 'backups', 'weighted'];
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="opacity-70">View</span>
      <select
        className="btn bg-transparent"
        value={view}
        onChange={(e) => onChange(e.target.value as ViewMode)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}