'use client';

import { useEffect, useMemo, useRef, useState, PointerEvent, WheelEvent } from 'react';

type ViewMode = 'starters' | 'backups' | 'weighted';
type DepthSlotStarter = { slotKey: string; pos: string; type:'starter'|'backup'; player: { id:string; name:string; ovr:number } | null; x:number; y:number; };
type DepthSlotWeighted = { slotKey: string; pos: string; type:'weighted'; players:{ id:string; name:string; ovr:number; w:number }[]; x:number; y:number; };
type DepthResponse = { formation:{ side:string; name:string; variant:string|null }; season:number; view:ViewMode; slots:(DepthSlotStarter|DepthSlotWeighted)[]; };

export function FormationCanvas({ formationId, season, view }: { formationId?: string; season: number; view: ViewMode; }) {
  const [data, setData] = useState<DepthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null); setData(null);
    if (!formationId) return;
    fetch(`/api/depth?formationId=${encodeURIComponent(formationId)}&season=${season}&view=${view}`)
      .then(r => r.json())
      .then((json) => { if (json?.error) throw new Error(json.error); setData(json as DepthResponse); })
      .catch(e => setErr(String(e?.message ?? e)));
  }, [formationId, season, view]); // ← fetching still responds to season/view

  // ---------- WORLD & CAMERA ----------
  const WORLD_W = 1600;
  const WORLD_H = 900;

  const normalizeAxis = (vals: number[]) => {
    const min = Math.min(...vals), max = Math.max(...vals);
    if (max <= 1.02 && min >= -0.02) return (v: number) => v;
    const span = Math.max(1e-6, max - min);
    return (v: number) => (v - min) / span;
  };

  const worldNodes = useMemo(() => {
    const S = data?.slots ?? [];
    if (!S.length) return [];
    const xs = S.map(s => s.x ?? 0), ys = S.map(s => s.y ?? 0);
    const to01x = normalizeAxis(xs), to01y = normalizeAxis(ys);
    return S.map(s => {
      const u = clamp(to01y(s.y ?? 0.5), 0, 1); // horizontal
      const v = clamp(to01x(s.x ?? 0.5), 0, 1); // vertical/depth
      return {
        key: s.slotKey,
        pos: s.pos,
        X: u * WORLD_W,
        Y: v * WORLD_H,
        player: (s as any).player ?? null
      };
    });
  }, [data?.slots]);

  const outerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const ZOOM_STEP = 1.02, minScale = 0.4, maxScale = 4;

  // --- Fit ONLY when the formation changes (NOT when season/view changes) ---
  const fittedOnce = useRef(false);
  const lastFormationId = useRef<string | undefined>(undefined);

  const fitToFormation = () => {
    const host = outerRef.current;
    if (!host || worldNodes.length === 0) return;
    const rect = host.getBoundingClientRect();
    const pad = 48;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of worldNodes) { if (n.X < minX) minX = n.X; if (n.Y < minY) minY = n.Y; if (n.X > maxX) maxX = n.X; if (n.Y > maxY) maxY = n.Y; }
    const bbW = Math.max(1, maxX - minX), bbH = Math.max(1, maxY - minY);
    const s = clamp(Math.min((rect.width - pad*2)/bbW, (rect.height - pad*2)/bbH), 0.25, 4);
    const worldCx = minX + bbW/2, worldCy = minY + bbH/2;
    const viewCx = rect.width/2, viewCy = rect.height/2;
    setScale(s);
    setTx(viewCx - worldCx * s);
    setTy(viewCy - worldCy * s);
  };

  // Fit when formation changes (and after first successful load)
  useEffect(() => {
    if (!formationId || !data) return;
    if (!fittedOnce.current || lastFormationId.current !== formationId) {
      fitToFormation();
      fittedOnce.current = true;
      lastFormationId.current = formationId;
    }
  }, [data, formationId]); // ← ignores season/view, so camera persists while scrubbing timeline

  // Pan/zoom interactions
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    setTx(v => v + dx); setTy(v => v + dy);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    (e.currentTarget as any).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  }
  function onWheel(e: WheelEvent<HTMLDivElement>) {
    const host = outerRef.current; if (!host) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const next = clamp(scale * factor, minScale, maxScale);
    setTx(prev => mx - (mx - prev) * (next / scale));
    setTy(prev => my - (my - prev) * (next / scale));
    setScale(next);
  }

  const zoomIn  = () => setScale(s => Math.min(maxScale, s * 1.1));
  const zoomOut = () => setScale(s => Math.max(minScale, s / 1.1));
  const resetView = () => fitToFormation();

  // Colors/labels
  const short = (pos: string) => pos.replace(/WR-?/, 'WR');
  const colorFor = (pos: string) => {
    const p = pos.toUpperCase();
    if (['QB'].includes(p)) return '#eab308';
    if (['HB','FB','RB'].includes(p)) return '#22c55e';
    if (['WR','TE'].includes(p)) return '#a78bfa';
    if (['LT','LG','C','RG','RT','LEDG','REDG'].includes(p)) return '#60a5fa';
    if (['DT','SAM','MIKE','WILL','CB','FS','SS','NB'].includes(p)) return '#f472b6';
    return '#94a3b8';
  };

  return (
    <div className="absolute inset-0 z-10">
      {/* Scene viewport */}
      <div
        ref={outerRef}
        className="absolute inset-0 rounded-[14px]"
        style={{ overflow:'hidden', touchAction:'none', cursor: drag ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* World */}
        <div
          style={{
            position:'relative',
            width: WORLD_W, height: WORLD_H,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid */}
          <div
            aria-hidden
            style={{
              position:'absolute', inset:0,
              backgroundImage:
                'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
              backgroundSize: '32px 32px, 32px 32px', opacity:.25
            }}
          />
          {/* Nodes */}
          {worldNodes.map(n => (
            <div
              key={n.key}
              style={{
                position:'absolute',
                left:n.X, top:n.Y, transform:'translate(-50%, -50%)',
                width:28, height:28, borderRadius:9999,
                background: colorFor(n.pos),
                border:'2px solid var(--chalk-stroke)',
                boxShadow:'0 0 0 2px rgba(0,0,0,0.25)',
                display:'grid', placeItems:'center',
                color:'#0f172a', fontWeight:800, fontSize:10,
                userSelect:'none', pointerEvents:'auto',
              }}
              title={short(n.pos)}
            >
              <span style={{ transform:'scale(.9)' }}>{short(n.pos)}</span>
            </div>
          ))}
        </div>

        {/* Camera controls — TOP RIGHT */}
        <div
          style={{
            position:'absolute',
            top: 10,
            right: 10,
            zIndex: 20,
            display: 'flex',
            gap: 8,
          }}
        >
          <button className="btn text-sm w-8 h-8" onClick={zoomIn}>＋</button>
          <button className="btn text-sm w-8 h-8" onClick={zoomOut}>－</button>
          <button className="btn text-sm w-8 h-8" onClick={resetView}>⟲</button>
        </div>
      </div>

      {!formationId && <div className="absolute inset-0 grid place-items-center opacity-70">Select a formation</div>}
      {err && <div className="absolute inset-0 p-3 text-red-400">{err}</div>}
      {!err && formationId && !data && <div className="absolute inset-0 grid place-items-center opacity-70">Loading…</div>}
    </div>
  );
}

function clamp(n:number, a:number, b:number){ return Math.max(a, Math.min(b, n)); }