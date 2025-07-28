'use client';

import {
  useMemo, useState, useEffect, useLayoutEffect, useRef,
  PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent,
} from 'react';

type ViewMode = 'starters' | 'backups' | 'weighted';

type SlotStarter = {
  slotKey: string;
  pos: string;
  type: 'starter' | 'starters' | 'backups';
  player: { id: string; name: string; ovr: number } | null;
  x: number | null;
  y: number | null;
};

type SlotWeighted = {
  slotKey: string;
  pos: string;
  type: 'weighted';
  ovr: number;
  contributors: { id: string; name: string; ovr: number; w: number }[];
  x: number | null;
  y: number | null;
};

type DepthResponse = {
  formation: { side: 'OFF' | 'DEF' | string; name: string; variant: string | null };
  season: number;
  view: ViewMode;
  slots: (SlotStarter | SlotWeighted)[];
};

type Formation = {
  id: string;
  side: 'OFF' | 'DEF' | string;
  name: string;
  variant: string | null;
};

/** Fixed field for fit math */
const FIELD_W = 1000;
const FIELD_H = 600;
/** Large scene so grid visibly pans */
const SCENE_W = 4000;
const SCENE_H = 3000;

/** Zoom tuning */
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_SENS = 0.0012; // mouse wheel
const PINCH_SENS = 0.02;  // pinch (ctrlKey on Mac)
const FIT_MARGIN = 0.18;

export default function ChalkFormation({
  season,
  side,
  onSideChange,
  initialView = 'starters',
}: {
  season: number;
  side: 'OFF' | 'DEF';
  onSideChange: (s: 'OFF' | 'DEF') => void;
  initialView?: ViewMode;
}) {
  /* ------------ formations list ------------ */
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationId, setFormationId] = useState<string | undefined>();
  const [view, setView] = useState<ViewMode>(initialView);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const res = await fetch('/api/formations', { cache: 'no-store' });
      const rows: Formation[] = await res.json();
      if (cancel) return;
      setFormations(rows);
      const first = rows.find((f) => f.side === side) ?? rows[0];
      if (first) setFormationId(first.id);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const list = formations.filter((f) => f.side === side);
    setFormationId((prev) => (list.find((f) => f.id === prev) ? prev : list[0]?.id));
  }, [side, formations]);

  const sideFormations = useMemo(() => formations.filter((f) => f.side === side), [formations, side]);

  const formationLabel = useMemo(() => {
    const f = sideFormations.find((x) => x.id === formationId);
    if (!f) return '(none)';
    return f.variant ? `${f.name}: ${f.variant}` : f.name;
  }, [sideFormations, formationId]);

  /* ------------ depth (coords) ------------ */
  const [depth, setDepth] = useState<DepthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reloadDepth(fid = formationId, v = view, s = season) {
    if (!fid) return;
    setErr(null);
    try {
      const res = await fetch(
        `/api/depth?formationId=${encodeURIComponent(fid)}&season=${s}&view=${v}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(await res.text());
      const json: DepthResponse = await res.json();
      setDepth(json);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load formation depth');
    }
  }

  useEffect(() => { reloadDepth(); }, [formationId, view, season]);

  useEffect(() => { // warm predictions (idempotent)
    fetch(`/api/progression?start=${season}&horizon=5`, { method: 'POST' }).catch(() => {});
  }, [season]);

  /* ------------ pan / zoom ------------ */
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.button !== 1) return; // left or middle button
    e.preventDefault();
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    e.preventDefault();
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setTx((v) => v + dx);
    setTy((v) => v + dy);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    (e.currentTarget as any).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    if (!outerRef.current) return;
    e.preventDefault(); // avoid page scroll

    const rect = outerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - tx;
    const my = e.clientY - rect.top - ty;

    const sens = e.ctrlKey ? PINCH_SENS : ZOOM_SENS;
    const raw = Math.exp(-e.deltaY * sens);
    const next = clamp(scale * raw, MIN_SCALE, MAX_SCALE);

    // keep cursor anchor stable
    setTx((prev) => prev - mx * (next / scale - 1));
    setTy((prev) => prev - my * (next / scale - 1));
    setScale(next);
  }

  function onDoubleClick() {
    fittedRef.current = '';
    fitNow(true);
  }

  /* ------------ nodes + auto-fit ------------ */
  const nodes = useMemo(() => {
    const slots = depth?.slots ?? [];
    return slots.map((s, idx) => {
      const { xPct, yPct } = slotToPercent(
        { x: (s as any).x ?? null, y: (s as any).y ?? null, pos: s.pos },
        idx,
      );
      const isQB = s.pos?.toUpperCase().startsWith('QB');
      const ok = s.type === 'weighted' ? true : !!(s as SlotStarter).player;
      const label =
        s.type === 'weighted'
          ? `${s.slotKey} • ${(s as SlotWeighted).ovr}`
          : `${s.slotKey} • ${ (s as SlotStarter).player ? (s as SlotStarter).player!.ovr : '--' }`;
      return {
        key: s.slotKey,
        role: s.pos,
        xPct,
        yPct,
        isQB,
        ok,
        label,
        contributors: (s as any).contributors as SlotWeighted['contributors'] | undefined,
      };
    });
  }, [depth]);

  const fitKey = `${formationId || ''}|${view}|${season}`;
  const fittedRef = useRef<string>('');

  // Fit when data arrives/changes
  useLayoutEffect(() => {
    if (!outerRef.current) return;
    if (nodes.length === 0) return;
    if (fittedRef.current === fitKey) return;
    const id = requestAnimationFrame(() => fitNow(false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, nodes.length]);

  // Refit on viewport resize
  useEffect(() => {
    if (!outerRef.current) return;
    const ro = new ResizeObserver(() => {
      fittedRef.current = '';
      fitNow(false);
    });
    ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, []);

  function fitNow(forceCenterFieldIfWeird: boolean) {
    if (!outerRef.current || nodes.length === 0) return;

    const viewportW = outerRef.current.clientWidth;
    const viewportH = outerRef.current.clientHeight;
    if (viewportW <= 0 || viewportH <= 0) return;

    // bbox of nodes in field % (0..100)
    let minX = 100, minY = 100, maxX = 0, maxY = 0;
    for (const n of nodes) {
      minX = Math.min(minX, n.xPct);
      maxX = Math.max(maxX, n.xPct);
      minY = Math.min(minY, n.yPct);
      maxY = Math.max(maxY, n.yPct);
    }

    const bboxWpx = (Math.max(8, maxX - minX) / 100) * FIELD_W;
    const bboxHpx = (Math.max(8, maxY - minY) / 100) * FIELD_H;

    const sx = ((1 - FIT_MARGIN) * viewportW) / bboxWpx;
    const sy = ((1 - FIT_MARGIN) * viewportH) / bboxHpx;
    const s = clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE);

    // center bbox in field
    const cxField = ((minX + maxX) / 2 / 100) * FIELD_W;
    const cyField = ((minY + maxY) / 2 / 100) * FIELD_H;

    // bbox center in scene coords (field is centered)
    const bboxCenterSceneX = SCENE_W / 2 - FIELD_W / 2 + cxField;
    const bboxCenterSceneY = SCENE_H / 2 - FIELD_H / 2 + cyField;

    const newTx = viewportW / 2 - s * bboxCenterSceneX;
    const newTy = viewportH / 2 - s * bboxCenterSceneY;

    setScale(s);
    setTx(newTx);
    setTy(newTy);
    fittedRef.current = fitKey;

    if (!forceCenterFieldIfWeird) return;

    // safety: if clearly offscreen, snap to field center
    setTimeout(() => {
      if (!outerRef.current) return;
      const fieldCenterSceneX = SCENE_W / 2;
      const fieldCenterSceneY = SCENE_H / 2;
      const tx2 = viewportW / 2 - s * fieldCenterSceneX;
      const ty2 = viewportH / 2 - s * fieldCenterSceneY;
      const dx = Math.abs(newTx - tx2);
      const dy = Math.abs(newTy - ty2);
      if (dx > viewportW * 2 || dy > viewportH * 2) {
        setTx(tx2);
        setTy(ty2);
      }
    }, 0);
  }

  const caption =
    depth &&
    `${depth.formation.side === 'OFF' ? 'OFFENSE' : 'DEFENSE'}${
      depth.formation.name ? ` — ${depth.formation.name}` : ''
    }${depth.formation.variant ? `: ${depth.formation.variant}` : ''}`;

  /* -------------------------------- render -------------------------------- */
  return (
    <div className="h-full scribble-surface relative overflow-hidden">
      {/* Title */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 text-sm z-30" onPointerDown={(e)=>e.stopPropagation()}>
        {caption ?? (side === 'OFF' ? 'OFFENSE' : 'DEFENSE')}
      </div>

      {/* Views (above scene, stop bubbling) */}
      <div
        className="absolute right-3 top-2 w-44 p-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] z-30"
        onPointerDown={(e)=>e.stopPropagation()}
      >
        <div className="text-xs opacity-80 mb-2">VIEWS</div>
        {(['starters', 'backups', 'weighted'] as ViewMode[]).map((m) => (
          <label key={m} className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="radio"
              name="view"
              checked={view === m}
              onChange={() => { fittedRef.current = ''; setView(m); }}
              className="accent-current"
            />
            <span className="text-sm capitalize">{m === 'weighted' ? 'Weighted Depth' : m}</span>
          </label>
        ))}
      </div>

      {/* Side toggles (above scene) */}
      <div className="absolute left-3 top-2 flex gap-2 z-30" onPointerDown={(e)=>e.stopPropagation()}>
        <button
          onClick={() => { fittedRef.current = ''; onSideChange('OFF'); }}
          className={`px-3 py-1 rounded-full border ${
            side === 'OFF'
              ? 'border-slate-900 dark:border-slate-100 bg-slate-900/10 dark:bg-slate-100 text-current'
              : 'border-[var(--panel-border)] bg-transparent hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          OFFENSE
        </button>
        <button
          onClick={() => { fittedRef.current = ''; onSideChange('DEF'); }}
          className={`px-3 py-1 rounded-full border ${
            side === 'DEF'
              ? 'border-slate-900 dark:border-slate-100 bg-slate-900/10 dark:bg-slate-100 text-current'
              : 'border-[var(--panel-border)] bg-transparent hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          DEFENSE
        </button>
      </div>

      {/* Formation dropdown (above scene) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-9 z-30" onPointerDown={(e)=>e.stopPropagation()}>
        <div className="relative group">
          <button className="px-3 py-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] hover:bg-black/5 dark:hover:bg-white/10 text-xs">
            {formationLabel}
          </button>
          <div className="absolute hidden group-hover:block z-40 min-w-[220px] mt-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-1 max-h-80 overflow-auto">
            {sideFormations.map((f) => (
              <div
                key={f.id}
                onClick={() => { fittedRef.current = ''; setFormationId(f.id); }}
                className="px-2 py-1.5 rounded cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
              >
                {f.variant ? `${f.name}: ${f.variant}` : f.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SCENE (below controls) */}
      <div
        ref={outerRef}
        className={`absolute inset-0 z-10 ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
      >
        <div
          className="absolute"
          style={{
            left: 0,
            top: 0,
            width: SCENE_W,
            height: SCENE_H,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid plane */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                `linear-gradient(var(--grid-major) 1px, transparent 1px) 0 0 / 64px 64px,
                 linear-gradient(90deg, var(--grid-major) 1px, transparent 1px) 0 0 / 64px 64px,
                 linear-gradient(var(--grid-minor) 1px, transparent 1px) 0 0 / 16px 16px,
                 linear-gradient(90deg, var(--grid-minor) 1px, transparent 1px) 0 0 / 16px 16px`,
            }}
          />

          {/* Field centered in the scene */}
          <div
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              width: FIELD_W,
              height: FIELD_H,
              transform: 'translate(-50%, -50%)',
              border:
                '1px solid color-mix(in oklab, var(--grid-major) 50%, transparent)',
              borderRadius: 8,
            }}
          >
            {/* Yard lines */}
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0"
                style={{
                  top: `${(i + 1) * 10}%`,
                  borderTop: '1px solid',
                  borderColor:
                    'color-mix(in oklab, var(--grid-major) 60%, transparent)',
                }}
              />
            ))}

            {/* Players */}
            {nodes.map((n) => (
              <PlayerDot
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
        </div>
      </div>

      {err && (
        <div className="absolute top-2 left-2 text-xs rounded px-2 py-1 bg-[var(--panel)] border border-[var(--panel-border)] z-30" onPointerDown={(e)=>e.stopPropagation()}>
          {err}
        </div>
      )}

      {/* Center & Fit button (above scene) */}
      <button
        onClick={() => { fittedRef.current = ''; fitNow(true); }}
        className="absolute bottom-3 right-3 px-3 py-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] text-xs hover:bg-black/5 dark:hover:bg-white/10 z-30"
        onPointerDown={(e)=>e.stopPropagation()}
      >
        Center & Fit
      </button>
    </div>
  );
}

/* ---------------------- coordinate normalization ----------------------- */
function slotToPercent(
  s: { x: number | null; y: number | null; pos: string },
  idx: number,
) {
  const has = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  if (has(s.x) && has(s.y)) {
    return { xPct: clamp01(s.x) * 100, yPct: clamp01(s.y) * 100 };
  }

  // Fallbacks only if x,y are missing
  const P = s.pos?.toUpperCase() ?? '';

  if (['LT', 'LG', 'C', 'RG', 'RT'].includes(P)) {
    const order = { LT: 0.15, LG: 0.20, C: 0.25, RG: 0.30, RT: 0.35 } as Record<string, number>;
    return { xPct: 50, yPct: (order[P] ?? 0.25) * 100 };
  }
  if (P.startsWith('WR')) {
    const i = idx % 5;
    const spread = [0.05, 0.15, 0.35, 0.45, 0.25][i];
    return { xPct: 60, yPct: spread * 100 };
  }
  if (P === 'TE') return { xPct: 52, yPct: 30 };
  if (P === 'QB') return { xPct: 65, yPct: 25 };
  if (P === 'HB' || P === 'FB') return { xPct: 70, yPct: 22 };

  if (['LEDG', 'REDG', 'DT'].includes(P)) {
    const map = { LEDG: 0.15, DT: 0.25, REDG: 0.35 } as Record<string, number>;
    return { xPct: 45, yPct: (map[P] ?? 0.25) * 100 };
  }
  if (['SAM', 'MIKE', 'WILL'].includes(P)) {
    const map = { SAM: 0.15, MIKE: 0.25, WILL: 0.35 } as Record<string, number>;
    return { xPct: 55, yPct: (map[P] ?? 0.25) * 100 };
  }
  if (P.startsWith('CB')) {
    const y = (idx % 2) === 0 ? 0.08 : 0.42;
    return { xPct: 40, yPct: y * 100 };
  }
  if (P === 'FS') return { xPct: 30, yPct: 25 };
  if (P === 'SS') return { xPct: 32, yPct: 30 };

  // generic fallback
  const col = (idx % 6) + 2;
  const row = Math.floor(idx / 6) + 3;
  return { xPct: 40 + row * 6, yPct: 10 + col * 12 };
}

/* ------------------------------ player dot ----------------------------- */
function PlayerDot({
  xPct,
  yPct,
  role,
  label,
  ok,
  isQB,
  contributors,
}: {
  xPct: number;
  yPct: number;
  role: string;
  label: string;
  ok: boolean;
  isQB: boolean;
  contributors?: { id: string; name: string; ovr: number; w: number }[];
}) {
  const fill = ok ? (isQB ? '#eab308' : '#6c5ce7') : '#6b7280';
  const textColor = isQB ? '#0b1220' : '#f8fafc';

  return (
    <div
      title={role}
      className="absolute grid place-items-center select-none"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: 'translate(-50%, -50%)',
        width: 28,
        height: 28,
        borderRadius: 14,
        background: fill,
        boxShadow: '0 0 0 2px rgba(255,255,255,.85), 0 2px 6px rgba(0,0,0,.35)',
        border: '1px solid rgba(0,0,0,.35)',
        fontWeight: 800,
        fontSize: 10,
        color: textColor,
        pointerEvents: 'auto',
      }}
    >
      <span style={{ transform: 'scale(.9)' }}>{short(role)}</span>

      {/* label under the dot */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-[11px]"
        style={{
          top: 32,
          whiteSpace: 'nowrap',
          color: 'var(--text)',
          textShadow: '0 1px 1px rgba(0,0,0,.35)',
        }}
      >
        {label}
      </div>

      {/* weighted contributors */}
      {contributors && contributors.length > 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-[10px]"
          style={{ top: 48, whiteSpace: 'nowrap', color: 'var(--muted)' }}
        >
          {contributors.map((c) => `${last(c.name)} ${Math.round(c.w * 100)}%`).join(' · ')}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- utils -------------------------------- */
function short(role: string) {
  return role.replace(/WR-?/, 'WR').replace(/CB(\d)/, 'CB$1');
}
function last(n: string) {
  return n.split(' ').slice(-1)[0];
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}