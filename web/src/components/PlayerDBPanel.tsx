'use client';

import * as React from 'react';

type Side = 'OFF' | 'DEF';
type ViewMode = 'positions' | 'ranking' | 'years';

type PlayerRow = {
  id: string;
  position: string;
  name: string;        // server may return full name; we’ll format as F.LAST
  heightFt?: number | null;
  heightIn?: number | null;
  weight?: number | null;
  ovr?: number | null;
  class?: 'Fr' | 'So' | 'Jr' | 'Sr' | 'RS-Fr' | 'RS-So' | 'RS-Jr' | 'RS-Sr' | string | null;
  yearsRemaining?: number | null;
};

export function PlayerDBPanel({
  season,
  side = 'OFF',
  onSeasonChange,
  onAddClick,
  onReloadRef,
}: {
  season: number;
  side?: Side;
  onSeasonChange?: (s: number) => void;
  onAddClick?: () => void;
  /** optional: parent can keep a ref and call it to force reload after a create */
  onReloadRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const [rows, setRows] = React.useState<PlayerRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ViewMode>('positions');
  const [loading, setLoading] = React.useState(false);

  // inside PlayerDBPanel
const fetchPlayers = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const url = new URL('/api/players', window.location.origin);
      url.searchParams.set('season', String(season));
      url.searchParams.set('rosterOnly', '1');
      if (side) url.searchParams.set('side', side);
  
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
  
      const json = await res.json(); // either [] or { players: [] }
      const list = Array.isArray(json) ? json : (json?.players ?? []);
      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load players');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [season, side]);

  // expose reload to parent (e.g., after Add Player)
  React.useEffect(() => {
    if (onReloadRef) onReloadRef.current = fetchPlayers;
    return () => { if (onReloadRef) onReloadRef.current = null; };
  }, [fetchPlayers, onReloadRef]);

  React.useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // ---- formatting helpers ---------------------------------------------------
  const abbr = (full: string) => {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    const firstToken = parts[0].replace(/[^A-Za-z]/g, '');
    const f = (firstToken[0] || '').toUpperCase();
    const last = (parts.at(-1) || '').toUpperCase();
    return f && last ? `${f}. ${last}` : (full || '').toUpperCase();
  };

  // sorting according to view
  const sorted = React.useMemo(() => {
    const copy = [...rows];

    // normalize nulls
    const getOVR = (p: PlayerRow) => (typeof p.ovr === 'number' ? p.ovr : -1);
    const getYears = (p: PlayerRow) =>
      typeof p.yearsRemaining === 'number' ? p.yearsRemaining : -1;

    if (view === 'ranking') {
      copy.sort((a, b) => getOVR(b) - getOVR(a));
      return copy;
    }

    if (view === 'years') {
      copy.sort((a, b) => getYears(b) - getYears(a) || getOVR(b) - getOVR(a));
      return copy;
    }

    // positions view: cluster by position, sort within by OVR desc
    copy.sort((a, b) => {
      const pa = (a.position || '').toUpperCase();
      const pb = (b.position || '').toUpperCase();
      if (pa < pb) return -1;
      if (pa > pb) return 1;
      return getOVR(b) - getOVR(a);
    });
    return copy;
  }, [rows, view]);

  // ---- UI -------------------------------------------------------------------
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* header row */}
      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <div className="flex items-center gap-2">
          <span className="opacity-80 text-xs">Season</span>
          <div className="inline-flex items-center border rounded px-1">
            <button
              className="px-1"
              onClick={() => onSeasonChange?.(season - 1)}
              aria-label="Prev Season"
            >
              –
            </button>
            <div className="px-2 text-sm tabular-nums">{season}</div>
            <button
              className="px-1"
              onClick={() => onSeasonChange?.(season + 1)}
              aria-label="Next Season"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="opacity-80 text-xs">View</label>
          <select
            className="input text-xs"
            value={view}
            onChange={(e) => setView(e.target.value as ViewMode)}
          >
            <option value="positions">Positions</option>
            <option value="ranking">Ranking</option>
            <option value="years">Years Remaining</option>
          </select>

          <button className="btn btn-sm" onClick={onAddClick}>Add Player</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[var(--panel-bg)] z-10">
            <tr className="text-left">
              <th className="px-2 py-1 w-[3.5rem]">Pos</th>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1 w-[3.5rem]">Ht</th>
              <th className="px-2 py-1 w-[3.5rem]">Wt</th>
              <th className="px-2 py-1 w-[3.5rem]">OVR</th>
              <th className="px-2 py-1 w-[3.5rem]">Class</th>
              <th className="px-2 py-1 w-[3.5rem]">Yrs</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-2 py-2 opacity-70">Loading…</td></tr>
            )}
            {!loading && err && (
              <tr><td colSpan={7} className="px-2 py-2 text-red-400">Failed to load players: {err}</td></tr>
            )}
            {!loading && !err && sorted.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-2 opacity-70">No players for {season}</td></tr>
            )}
            {!loading && !err && sorted.map((p) => (
              <tr key={p.id} className="border-t border-[var(--chalk-stroke)]/20">
                <td className="px-2 py-1">{(p.position || '').toUpperCase()}</td>
                <td className="px-2 py-1">{abbr(p.name)}</td>
                <td className="px-2 py-1">
                  {p.heightFt ?? '—'}{p.heightFt != null ? '′' : ''}
                  {p.heightIn != null ? `${p.heightIn}″` : ''}
                </td>
                <td className="px-2 py-1">{p.weight ?? '—'}</td>
                <td className="px-2 py-1">{p.ovr ?? '—'}</td>
                <td className="px-2 py-1">{p.class ?? '—'}</td>
                <td className="px-2 py-1">{p.yearsRemaining ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}