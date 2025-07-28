'use client';

import {
  useMemo, useState, useEffect, useRef,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

type ViewMode = 'starters' | 'backups' | 'weighted';

type SlotStarter = {
  slotKey: string;
  pos: string;
  type: 'starter' | 'backup';
  player: { id: string; name: string; ovr: number } | null;
  x: number;
  y: number;
};

type SlotWeighted = {
  slotKey: string;
  pos: string;
  type: 'weighted';
  ovr: number;
  contributors: { id: string; name: string; ovr: number; w: number }[];
  x: number;
  y: number;
};

type DepthResponse = {
  formation: { side: 'OFF' | 'DEF' | string; name: string; variant: string | null };
  season: number;
  view: ViewMode;
  slots: (SlotStarter | SlotWeighted)[];
};

type Formation = { id: string; side: 'OFF' | 'DEF' | string; name: string; variant: string | null };

export default function FormationSurface({
  season,
  side,
  onSideChange,
  initialView = 'starters',
}: {
  season: number;
  side: 'OFF'|'DEF';
  onSideChange: (s: 'OFF'|'DEF') => void;
  initialView?: ViewMode;
}) {
  /* formations */
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationId, setFormationId] = useState<string | undefined>(undefined);
  const [view, setView] = useState<ViewMode>(initialView);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/formations', { cache: 'no-store' });
      const rows: Formation[] = await res.json();
      setFormations(rows);
      const first = rows.find(f => f.side === side) ?? rows[0];
      if (first) setFormationId(first.id);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const list = formations.filter(f => f.side === side);
    setFormationId(prev => (list.find(f => f.id === prev) ? prev : list[0]?.id));
  }, [side, formations]);

  const sideFormations = useMemo(() => formations.filter(f => f.side === side), [formations, side]);
  const formationLabel = useMemo(() => {
    const f = sideFormations.find(x => x.id === formationId);
    if (!f) return '(none)';
    return f.variant ? `${f.name}: ${f.variant}` : f.name;
  }, [sideFormations, formationId]);

  /* depth */
  const [depth, setDepth] = useState<DepthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reloadDepth(fid = formationId, v = view, s = season) {
    if (!fid) return;
    setErr(null);
    setDepth(null);
    try {
      const res = await fetch(`/api/depth?formationId=${fid}&season=${s}&view=${v}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json: DepthResponse = await res.json();
      setDepth(json);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load formation depth');
    }
  }

  useEffect(() => { reloadDepth(); }, [formationId, view, season]);

  // ensure predictions window exists
  useEffect(() => {
    fetch(`/api/progression?start=${season}&horizon=5`, { method: 'POST' }).catch(() => {});
  }, [season]);

  /* pan/zoom */
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const minScale = 0.5, maxScale = 3, ZOOM_STEP = 1.02;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    setTx(v => v + dx); setTy(v => v + dy);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    (e.currentTarget as any).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  }
  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    if (!outerRef.current) return;
    e.preventDefault();
    const rect = outerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - tx, my = e.clientY - rect.top - ty;
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const next = clamp(scale * factor, minScale, maxScale);
    setTx((prev) => prev - mx * (next / scale - 1));
    setTy((prev) => prev - my * (next / scale - 1));
    setScale(next);
  }
  function resetView() { setScale(1); setTx(0); setTy(0); }

  /* render nodes */
  const nodes = useMemo(() => {
    const slots = depth?.slots ?? [];
    return slots.map(s => ({
      key: s.slotKey,
      role: s.pos,
      xPct: (s as any).x * 100,
      yPct: (s as any).y * 100,
      label: s.type === 'weighted' ? `${s.slotKey} • ${s.ovr}` : `${s.slotKey} • ${s.player ? s.player.ovr : '--'}`,
      ok: s.type === 'weighted' ? true : !!(s as SlotStarter).player,
      isQB: s.pos.toUpperCase().startsWith('QB'),
      contributors: (s as any).contributors as SlotWeighted['contributors'] | undefined,
    }));
  }, [depth]);

  const caption =
    depth && `${depth.formation.side === 'OFF' ? 'OFFENSE' : 'DEFENSE'} — ${
      depth.formation.variant ? `${depth.formation.name}: ${depth.formation.variant}` : depth.formation.name
    }`;

  return (
    <div className="h-full flex flex-col rounded-xl border border-slate-700/70 bg-slate-900/40">
      {/* Toolbar */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-slate-700/70">
        <div className="flex items-center gap-4 text-[13px]">
          {/* side selector */}
          <div className="inline-flex rounded-md overflow-hidden border border-slate-700/70">
            <button
              onClick={() => onSideChange('OFF')}
              className={`px-3 py-1.5 ${side==='OFF' ? 'bg-slate-200 text-slate-900' : 'text-slate-300 hover:bg-slate-800/60'}`}
            >
              &lt; OFFENSE &gt;
            </button>
            <button
              onClick={() => onSideChange('DEF')}
              className={`px-3 py-1.5 ${side==='DEF' ? 'bg-slate-200 text-slate-900' : 'text-slate-300 hover:bg-slate-800/60'}`}
            >
              &lt; DEFENSE &gt;
            </button>
          </div>

          {/* formation dropdown */}
          <div className="relative group">
            <button className="px-3 py-1.5 rounded-md border border-slate-700/70 bg-slate-900/60 hover:bg-slate-800/60">
              {formationLabel}
            </button>
            <div className="absolute hidden group-hover:block mt-1 z-20 min-w-[220px] rounded-md border border-slate-700/70 bg-[#0b1220] p-1">
              {sideFormations.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setFormationId(f.id)}
                  className="px-2 py-1.5 rounded cursor-pointer hover:bg-slate-800/60"
                >
                  {f.variant ? `${f.name}: ${f.variant}` : f.name}
                </div>
              ))}
            </div>
          </div>

          {/* view modes */}
          <div className="inline-flex rounded-md overflow-hidden border border-slate-700/70">
            {(['starters','backups','weighted'] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setView(m)}
                className={`px-3 py-1.5 ${view===m ? 'bg-sky-500 text-slate-900' : 'text-slate-300 hover:bg-slate-800/60'}`}
              >
                {m[0].toUpperCase()+m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => clamp(s*1.1, minScale, maxScale))} className="p-2 rounded border border-slate-700/70 hover:bg-slate-800/60"><ZoomIn size={16} /></button>
          <button onClick={() => setScale(s => clamp(s/1.1, minScale, maxScale))} className="p-2 rounded border border-slate-700/70 hover:bg-slate-800/60"><ZoomOut size={16} /></button>
          <button onClick={resetView} className="p-2 rounded border border-slate-700/70 hover:bg-slate-800/60"><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={outerRef}
        className="relative flex-1 min-h-0 overflow-hidden m-2 rounded-lg border border-slate-600 bg-[#0b1220] touch-pan-y cursor-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: '0 0' }}
        >
          {/* Grid */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(#1f293733 1px, transparent 1px), linear-gradient(90deg, #1f293733 1px, transparent 1px)',
              backgroundSize: '32px 32px, 32px 32px',
            }}
          />
          {/* Yard lines */}
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-[#404040]"
              style={{ top: `${(i + 1) * 10}%` }}
            />
          ))}
          {/* Caption */}
          {caption && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 text-slate-300 text-[12px]">
              {caption}
            </div>
          )}

          {/* Nodes */}
          {nodes.map((n) => (
            <Node
              key={n.key}
              xPct={n.xPct}
              yPct={n.yPct}
              role={n.role}
              label={n.label}
              ok={n.ok}
              isQB={n.isQB}
              contributors={n.contributors}
            />
          ))}
        </div>

        {err && (
          <div className="absolute top-2 left-2 text-xs rounded px-2 py-1 bg-[#0b1220]/90 border border-red-900 text-red-200">
            {err}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-10 px-3 flex items-center justify-between border-t border-slate-700/70 text-xs text-slate-400">
        <div>Season {season} • View {view}</div>
        <div>Drag to pan • Scroll to zoom</div>
      </div>
    </div>
  );
}

/* atoms */

function Node({
  xPct, yPct, role, label, ok, isQB, contributors,
}: {
  xPct: number; yPct: number; role: string; label: string; ok: boolean; isQB: boolean;
  contributors?: { id: string; name: string; ovr: number; w: number }[];
}) {
  const fill = ok ? (isQB ? '#eab308' : '#7c3aed') : '#6b7280';
  return (
    <div
      title={role}
      className="absolute grid place-items-center"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: 'translate(-50%, -50%)',
        width: 28, height: 28, borderRadius: 14,
        background: fill,
        border: '2px solid #94a3b8',
        boxShadow: '0 0 0 2px rgba(0,0,0,0.25)',
        userSelect: 'none',
        pointerEvents: 'auto',
        color: '#0f172a',
        fontWeight: 800,
        fontSize: 10,
      }}
    >
      <span style={{ transform: 'scale(.9)' }}>{short(role)}</span>

      {/* label below */}
      <div className="absolute left-1/2 -translate-x-1/2 text-slate-100 text-[11px]" style={{ top: 32, whiteSpace: 'nowrap', textShadow: '0 1px 1px #000' }}>
        {label}
      </div>

      {/* contributors (weighted) */}
      {contributors && (
        <div className="absolute left-1/2 -translate-x-1/2 text-slate-400 text-[10px]" style={{ top: 48, whiteSpace: 'nowrap' }}>
          {contributors.map(c => `${last(c.name)} ${Math.round(c.w*100)}%`).join(' · ')}
        </div>
      )}
    </div>
  );
}

/* utils */
function short(role: string) { return role.replace(/WR-?/, 'WR').replace(/CB(\d)/, 'CB$1'); }
function last(n: string) { return n.split(' ').slice(-1)[0]; }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }