'use client';

import * as React from 'react';
import type { ViewMode } from './FormationControls';

type DepthSlotStarter = { slotKey: string; pos: string; type: 'starter'|'backup'; player: { id: string; name: string; ovr: number } | null; x: number; y: number };
type DepthSlotWeighted = { slotKey: string; pos: string; type: 'weighted'; ovr: number; contributors: { id: string; name: string; ovr: number; w: number }[]; x: number; y: number };
type DepthResponse = {
  formation: { side: string; name: string; variant: string | null };
  season: number;
  view: ViewMode;
  slots: (DepthSlotStarter | DepthSlotWeighted)[];
};

export function FormationCanvas({ formationId, season, view }: { formationId?: string; season: number; view: ViewMode }) {
  const [data, setData] = React.useState<DepthResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancel = false;
    async function run() {
      setErr(null);
      setData(null);
      if (!formationId) return;
      try {
        const res = await fetch(`/api/depth?formationId=${formationId}&season=${season}&view=${view}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (!cancel) setData(json);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? 'Failed to load depth');
      }
    }
    run();
    return () => { cancel = true; };
  }, [formationId, season, view]);

  return (
    <div className="relative w-full h-full">
      {/* Field background */}
      <div className="absolute inset-0 rounded border border-neutral-700 overflow-hidden">
        <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="w-full h-full">
          <rect x="0" y="0" width="1000" height="700" fill="none" />
          {/* simple yard lines */}
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1="0" x2="1000" y1={70*(i+1)} y2={70*(i+1)} stroke="#404040" strokeWidth="1" />
          ))}

          {/* Nodes */}
          {data?.slots.map((s, i) => {
            const cx = s.x * 1000;
            const cy = s.y * 700;
            const label = s.type === 'weighted'
              ? `${s.slotKey} • ${s.ovr}`
              : `${s.slotKey} • ${s.player ? s.player.ovr : '--'}`;
            const ok = s.type === 'weighted' ? true : !!s.player;
            return (
              <g key={i} transform={`translate(${cx}, ${cy})`}>
                <circle r="24" fill={ok ? '#1f5132' : '#5a1f1f'} stroke="#8b8b8b" strokeWidth="1.5" />
                <text x="0" y="-18" textAnchor="middle" fontSize="10" fill="#d4d4d4">{s.pos}</text>
                <text x="0" y="4" textAnchor="middle" fontSize="11" fill="#e5e5e5">{label}</text>
                {s.type === 'weighted' && (
                  <text x="0" y="22" textAnchor="middle" fontSize="9" fill="#9ca3af">
                    {s.contributors.map(c => `${c.name.split(' ').slice(-1)[0]} ${Math.round(c.w*100)}%`).join(' · ')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {!formationId && <div className="absolute inset-0 grid place-items-center text-neutral-400">Select a formation</div>}
      {err && <div className="absolute inset-0 p-2 text-red-400">{err}</div>}
      {!err && formationId && !data && <div className="absolute inset-0 grid place-items-center text-neutral-400">Loading…</div>}
      {data && data.slots.length === 0 && <div className="absolute inset-0 grid place-items-center text-neutral-400">No players for this season.</div>}
    </div>
  );
}