'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  PointerEvent,
  WheelEvent,
} from 'react';

export type ViewMode = 'starters' | 'backups' | 'weighted';

type DepthSlotStarter = {
  slotKey: string;
  pos: string;
  type: 'starter' | 'backup';
  player: { id: string; name: string; ovr: number; devTrait?: 'Normal'|'Impact'|'Star'|'Elite'|null } | null;
  x: number;
  y: number;
};

type DepthSlotWeighted = {
  slotKey: string;
  pos: string;
  type: 'weighted';
  players: { id: string; name: string; ovr: number; w: number }[];
  x: number;
  y: number;
};

type DepthResponse = {
  formation: { side: string; name: string; variant: string | null };
  season: number;
  view: ViewMode;
  slots: (DepthSlotStarter | DepthSlotWeighted)[];
};

// Toggle which parts to render on each node
type DisplayOpts = {
  showPos: boolean;
  showOvr: boolean;
  showDevRing: boolean;
  showName: boolean;
};

export type FormationCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
};

export const FormationCanvas = forwardRef<FormationCanvasHandle, {
  formationId?: string;
  season: number;
  view: ViewMode;
}>(
function FormationCanvas({ formationId, season, view }, ref) {
  const [data, setData] = useState<DepthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // node display toggles
  const [opts, setOpts] = useState<DisplayOpts>({
    showPos: true,
    showOvr: true,
    showDevRing: true,
    showName: true,
  });

  useEffect(() => {
    setErr(null);
    setData(null);
    if (!formationId) return;
    fetch(`/api/depth?formationId=${encodeURIComponent(formationId)}&season=${season}&view=${view}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.error) throw new Error(json.error);
        setData(json as DepthResponse);
      })
      .catch((e) => setErr(String(e?.message ?? e)));
  }, [formationId, season, view]);

  // ---------- WORLD & CAMERA ----------
  const WORLD_W = 1600;
  const WORLD_H = 900;

  const normalizeAxis = (vals: number[]) => {
    const min = Math.min(...vals),
      max = Math.max(...vals);
    if (max <= 1.02 && min >= -0.02) return (v: number) => v;
    const span = Math.max(1e-6, max - min);
    return (v: number) => (v - min) / span;
  };

  // Color helpers -------------------------------------------------------------
  const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const hex = (n: number) => {
    const s = Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');
    return s;
  };
  // Viridis stops (RGB in 0..1), sampled ~7 points; we’ll interpolate
  const VIRIDIS: [number, number, number][] = [
    [0.267, 0.004, 0.329],
    [0.283, 0.141, 0.458],
    [0.254, 0.265, 0.530],
    [0.207, 0.372, 0.553],
    [0.164, 0.471, 0.558],
    [0.128, 0.566, 0.551],
    [0.135, 0.659, 0.518],
    [0.267, 0.749, 0.441],
    [0.478, 0.821, 0.318],
    [0.741, 0.873, 0.150],
  ];
  const viridis = (t: number) => {
    const x = clamp01(t) * (VIRIDIS.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    const a = VIRIDIS[i], b = VIRIDIS[Math.min(i + 1, VIRIDIS.length - 1)];
    const r = lerp(a[0], b[0], f), g = lerp(a[1], b[1], f), b3 = lerp(a[2], b[2], f);
    return `#${hex(r)}${hex(g)}${hex(b3)}`;
  };
  // Relative luminance → pick white/black text
  const luminance = (hexColor: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hexColor);
    if (!m) return 0.5;
    const v = m[1];
    const r = parseInt(v.slice(0, 2), 16) / 255;
    const g = parseInt(v.slice(2, 4), 16) / 255;
    const b = parseInt(v.slice(4, 6), 16) / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L;
  };

  const devRing = (trait: string | null | undefined) => {
    switch (trait) {
      case 'Normal': return '#fca5a5'; // light red
      case 'Impact': return '#cbd5e1'; // gray 300
      case 'Star':   return '#34d399'; // emerald 400/500
      case 'Elite':  return '#93c5fd'; // sky 300
      default:       return '#cbd5e1'; // neutral ring for unknown / AVG
    }
  };

  // Build drawable nodes
  type NodeVM = {
    key: string;
    pos: string;
    X: number;
    Y: number;
    empty: boolean;
    isWeighted: boolean;
    fill: string;        // viridis color by OVR
    ring: string;        // dev trait ring color
    textColor: string;   // contrast text
    topLabel: string;    // position label (optional)
    centerLabel: string; // OVR / AVG
    bottomLabel: string; // name (optional)
    title: string;       // tooltip
  };

  const worldNodes = useMemo<NodeVM[]>(() => {
    const S = data?.slots ?? [];
    if (!S.length) return [];
    const xs = S.map((s) => s.x ?? 0),
      ys = S.map((s) => s.y ?? 0);
    const to01x = normalizeAxis(xs),
      to01y = normalizeAxis(ys);

    return S.map((s) => {
      const u = clamp(to01y(s.y ?? 0.5), 0, 1);
      const v = clamp(to01x(s.x ?? 0.5), 0, 1);

      let empty = false;
      let isWeighted = false;
      let ovr: number | null = null;
      let name = '';
      let dTrait: 'Normal'|'Impact'|'Star'|'Elite'|null|undefined = null;

      if (s.type === 'weighted') {
        isWeighted = true;
        const arr = s.players ?? [];
        // weighted average based on provided weights
        let ws = 0, wsum = 0;
        for (const p of arr) {
          if (Number.isFinite(p.ovr) && Number.isFinite(p.w) && p.w > 0) {
            ws += p.ovr * p.w; wsum += p.w;
          }
        }
        ovr = wsum > 0 ? Math.round(ws / wsum) : null;
        empty = ovr == null;
        name = 'AVG';
      } else {
        const p = s.player;
        if (!p) {
          empty = true;
        } else {
          ovr = Number.isFinite(p.ovr) ? p.ovr : null;
          name = p.name ?? '';
          dTrait = p.devTrait ?? null;
        }
      }

      // Viridis by OVR (50..99 -> 0..1). If null, desaturate.
      const t = ovr == null ? 0 : clamp01((ovr - 50) / 50);
      const fill = ovr == null ? '#94a3b8' /* slate-400 */ : viridis(t);
      const textColor = luminance(fill) < 0.5 ? '#f8fafc' : '#0f172a'; // white on dark, slate-900 on light
      const ring = isWeighted ? devRing(null) : devRing(dTrait ?? null);

      const posLabel = s.pos.toUpperCase();
      const top = posLabel; // we’ll show/hide in render via opts
      const center = ovr == null ? '—' : String(ovr);
      const bottom = name;

      const title = isWeighted
        ? `${posLabel} · AVG ${center}`
        : empty ? `${posLabel} · No player`
                : `${posLabel} · ${bottom} (${center})${dTrait ? ' · ' + dTrait : ''}`;

      return {
        key: s.slotKey,
        pos: s.pos,
        X: u * WORLD_W,
        Y: v * WORLD_H,
        empty,
        isWeighted,
        fill,
        ring,
        textColor,
        topLabel: top,
        centerLabel: center,
        bottomLabel: bottom,
        title,
      };
    });
  }, [data?.slots]);

  // Camera / interactions -----------------------------------------------------
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const ZOOM_STEP = 1.02,
    minScale = 0.4,
    maxScale = 4;

  const fittedOnce = useRef(false);
  const lastFormationId = useRef<string | undefined>(undefined);

  const fitToFormation = () => {
    const host = outerRef.current;
    if (!host || worldNodes.length === 0) return;
    const rect = host.getBoundingClientRect();
    const pad = 200;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of worldNodes) {
      if (n.X < minX) minX = n.X;
      if (n.Y < minY) minY = n.Y;
      if (n.X > maxX) maxX = n.X;
      if (n.Y > maxY) maxY = n.Y;
    }
    const bbW = Math.max(1, maxX - minX), bbH = Math.max(1, maxY - minY);
    const s = clamp(Math.min((rect.width - pad * 2) / bbW, (rect.height - pad * 2) / bbH), 0.25, 4);
    const worldCx = minX + bbW / 2, worldCy = minY + bbH / 2;
    const viewCx = rect.width / 2, viewCy = rect.height / 2;
    setScale(s);
    setTx(viewCx - worldCx * s);
    setTy(viewCy - worldCy * s);
  };

  useEffect(() => {
    if (!formationId || !data) return;
    if (!fittedOnce.current || lastFormationId.current !== formationId) {
      fitToFormation();
      fittedOnce.current = true;
      lastFormationId.current = formationId;
    }
  }, [data, formationId]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => setScale((s) => Math.min(maxScale, s * 1.1)),
    zoomOut: () => setScale((s) => Math.max(minScale, s / 1.1)),
    fit: () => fitToFormation(),
  }));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    setTx((v) => v + dx); setTy((v) => v + dy);
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
    setTx((prev) => mx - (mx - prev) * (next / scale));
    setTy((prev) => my - (my - prev) * (next / scale));
    setScale(next);
  }

  const zoomInBtn  = () => setScale((s) => Math.min(maxScale, s * 1.1));
  const zoomOutBtn = () => setScale((s) => Math.max(minScale, s / 1.1));
  const resetView  = () => fitToFormation();

  return (
    <div className="absolute inset-0 z-10">
      {/* Display toggles (TOP-LEFT) */}
      <div
        className="overlay-card text-sm px-3 py-2"
        style={{ position: 'absolute', top: 10, left: 10, zIndex: 60, pointerEvents: 'auto' }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="font-semibold mb-1 opacity-90">Display</div>
        <label className="mr-3"><input type="checkbox" checked={opts.showPos} onChange={e => setOpts(o => ({...o, showPos:e.target.checked}))} /> Position</label>
        <label className="mr-3"><input type="checkbox" checked={opts.showOvr} onChange={e => setOpts(o => ({...o, showOvr:e.target.checked}))} /> Overall</label>
        <label className="mr-3"><input type="checkbox" checked={opts.showDevRing} onChange={e => setOpts(o => ({...o, showDevRing:e.target.checked}))} /> Dev ring</label>
        <label><input type="checkbox" checked={opts.showName} onChange={e => setOpts(o => ({...o, showName:e.target.checked}))} /> Name</label>
      </div>

      {/* Scene viewport */}
      <div
        ref={outerRef}
        className="absolute inset-0 rounded-[14px]"
        style={{ overflow: 'hidden', touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* World */}
        <div
          style={{
            position: 'relative',
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
              backgroundSize: '32px 32px, 32px 32px',
              opacity: 0.25,
            }}
          />

          {/* Nodes */}
          {worldNodes.map((n) => (
            <div
              key={n.key}
              style={{
                position: 'absolute',
                left: n.X,
                top: n.Y,
                transform: 'translate(-50%, -50%)',
                width: 64,
                height: 64,
                borderRadius: 9999,
                border: opts.showDevRing ? `4px solid ${n.ring}` : '4px solid rgba(0,0,0,0.25)',
                boxShadow: '0 0 0 2px rgba(0,0,0,0.35)',
                display: 'grid',
                placeItems: 'center',
                userSelect: 'none',
                pointerEvents: 'auto',
                background: n.fill,
                color: n.textColor,
              }}
              title={n.title}
            >
              {/* inner dark stroke to keep number readable */}
              <div
                style={{
                  position: 'absolute',
                  inset: 4,
                  borderRadius: '9999px',
                  boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.30), inset 0 0 0 6px rgba(255,255,255,0.06)',
                }}
              />

              {/* position tag */}
              {opts.showPos && (
                <div
                  style={{
                    position: 'absolute',
                    top: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    opacity: 0.9,
                    color: '#e5e7eb',
                    textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                  }}
                >
                  {n.pos.toUpperCase()}
                </div>
              )}

              {/* content */}
              {!n.empty ? (
                <>
                  {opts.showOvr && (
                    <div style={{ position:'relative', fontWeight: 900, fontSize: 20, lineHeight: 1, textShadow:'0 1px 1px rgba(0,0,0,0.25)'}}>
                      {n.centerLabel}
                    </div>
                  )}
                  {opts.showName && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -18,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#e5e7eb',
                        textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.bottomLabel}
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center" title="No player">
                  <span style={{ fontSize: 28, fontWeight: 900, color: '#ef4444', textShadow:'0 1px 2px rgba(0,0,0,0.55)'}}>✕</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Camera controls — TOP RIGHT */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 70,
            display: 'flex',
            gap: 8,
            pointerEvents: 'auto',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <button className="btn text-sm w-8 h-8" onClick={zoomInBtn}>＋</button>
          <button className="btn text-sm w-8 h-8" onClick={zoomOutBtn}>－</button>
          <button className="btn text-sm w-8 h-8" onClick={resetView}>⟲</button>
        </div>
      </div>

      {!formationId && <div className="absolute inset-0 grid place-items-center opacity-70">Select a formation</div>}
      {err && <div className="absolute inset-0 p-3 text-red-400">{err}</div>}
      {!err && formationId && !data && <div className="absolute inset-0 grid place-items-center opacity-70">Loading…</div>}
    </div>
  );
});

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default FormationCanvas;