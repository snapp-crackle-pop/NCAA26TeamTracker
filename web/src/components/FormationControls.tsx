'use client';

import * as React from 'react';

type Formation = { id: string; side: 'OFF'|'DEF'|string; name: string; variant: string | null };

export type ViewMode = 'starters' | 'backups' | 'weighted';

export function FormationControls(props: {
  formations: Formation[];
  side: 'OFF'|'DEF';
  formationId?: string;
  view: ViewMode;
  onSideChange: (side: 'OFF'|'DEF') => void;
  onFormationChange: (id: string) => void;
  onViewChange: (v: ViewMode) => void;
}) {
  const { formations, side, formationId, view, onSideChange, onFormationChange, onViewChange } = props;

  const sideFormations = formations.filter(f => f.side === side);
  const labelFor = (f: Formation) => f.variant ? `${f.name}: ${f.variant}` : f.name;

  React.useEffect(() => {
    // ensure a valid formation is selected when side changes
    if (!formationId || !sideFormations.some(f => f.id === formationId)) {
      if (sideFormations[0]) onFormationChange(sideFormations[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, formations.length]);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex gap-2">
        <button
          className={`px-3 py-1 rounded ${side==='OFF'?'bg-emerald-700':'bg-neutral-800'}`}
          onClick={() => onSideChange('OFF')}
        >Offense</button>
        <button
          className={`px-3 py-1 rounded ${side==='DEF'?'bg-emerald-700':'bg-neutral-800'}`}
          onClick={() => onSideChange('DEF')}
        >Defense</button>
      </div>

      <select
        className="bg-neutral-800 px-2 py-1 rounded"
        value={formationId}
        onChange={e => onFormationChange(e.target.value)}
      >
        {sideFormations.map(f => (
          <option key={f.id} value={f.id}>{labelFor(f)}</option>
        ))}
      </select>

      <div className="flex gap-2">
        {(['starters','backups','weighted'] as ViewMode[]).map(m => (
          <button
            key={m}
            className={`px-3 py-1 rounded ${view===m?'bg-sky-700':'bg-neutral-800'}`}
            onClick={() => onViewChange(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}