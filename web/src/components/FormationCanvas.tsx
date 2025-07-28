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

  // pan/zoom state
  const [scale, setScale] = React.useState(1);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);
  const dragging = React.useRef<null | { x: number; y: number; tx: number; ty: number }>(null);

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

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.06 : 0.94;
    setScale(s => Math.min(3, Math.max(0.5, s * factor)));
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.currentTarget as any).setPointerCapture(e.pointerId);
    dragging.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    setTx(dragging.current.tx + dx);
    setTy(dragging.current.ty + dy);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = null;
  };
  const resetView = () => { setScale(1); setTx(0); setTy(0); };

  return (
    <div className="relative w-full h-full rounded border border-neutral-700 overflow-hidden">
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="none"
        className="w-full h-full touch-pan-y"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* grid background */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#2b2b2b" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect x="0" y="0" width="1000" height="700" fill="url(#grid)" />

        {/* zoomable layer */}
        <g transform={`translate(${tx},${ty}) scale(${scale})`}>
          {/* yard lines */}
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1="0" x2="1000" y1={70*(i+1)} y2={70*(i+1)} stroke="#404040" strokeWidth="1" />
          ))}

          {/* nodes */}
          {data?.slots.map((s, i) => {
            const cx = s.x * 1000;
            const cy = s.y * 700;
            const label = s.type === 'weighted'
              ? `${s.slotKey} • ${s.ovr}`
              : `${s.slotKey} • ${s.player ? s.player.ovr : '--'}`;
            const ok = s.type === 'weighted' ? true : !!s.player;
            return (
              <g key={i} transform={`translate(${cx}, ${cy})`}>
                <circle r="24" fill={ok ? '#4f46e5' : '#6b7280'} stroke="#e5e7eb" strokeWidth="1.5" />
                <text x="0" y="-18" textAnchor="middle" fontSize="10" fill="#d1d5db">{s.pos}</text>
                <text x="0" y="4" textAnchor="middle" fontSize="11" fill="#f3f4f6">{label}</text>
                {s.type === 'weighted' && (
                  <text x="0" y="22" textAnchor="middle" fontSize="9" fill="#9ca3af">
                    {s.contributors.map(c => `${c.name.split(' ').slice(-1)[0]} ${Math.round(c.w*100)}%`).join(' · ')}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* overlay labels/errors */}
      {!formationId && <div className="absolute inset-0 grid place-items-center text-neutral-400">Select a formation</div>}
      {err && <div className="absolute top-2 left-2 text-sm text-red-400 bg-neutral-900/70 px-2 py-1 rounded">{err}</div>}

      {/* top caption like your mockup */}
      {data && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-neutral-300">
          &lt; {data.formation.side === 'OFF' ? 'OFFENSE' : 'DEFENSE'} &gt;&nbsp;
          <span className="text-neutral-400">{data.formation.name}{data.formation.variant ? `: ${data.formation.variant}` : ''}</span>
        </div>
      )}

      {/* view reset */}
      <button
        onClick={resetView}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700"
        title="Reset zoom/pan"
      >Reset View</button>

      {/* bottom timeline dock (UI only; `season` is controlled by page slider) */}
      <div className="absolute bottom-0 left-0 right-0 h-12 border-t border-neutral-700 bg-neutral-900/80 backdrop-blur flex items-center px-3 text-sm text-neutral-300">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-neutral-400" />
          <span>Season {season}</span>
        </div>
        <div className="ml-auto text-neutral-500">Drag canvas to pan • Scroll to zoom</div>
      </div>
    </div>
  );
}