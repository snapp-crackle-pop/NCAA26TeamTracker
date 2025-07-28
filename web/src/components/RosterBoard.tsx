'use client';

import * as React from 'react';
import { ovrBand, sidePositions } from '@/lib/positions';

type Row = { pos: string; players: { id: string; name: string; ovr: number; cls: string }[] };
type ApiResp = { side: 'OFF'|'DEF'; season: number; rows: Row[] };

export function RosterBoard({
  season,
  side,
  onSideChange,
  onAddClick,
}: {
  season: number;
  side: 'OFF'|'DEF';
  onSideChange: (s: 'OFF'|'DEF') => void;
  onAddClick: () => void;
}) {
  const [data, setData] = React.useState<ApiResp | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      setErr(null);
      try {
        const res = await fetch(`/api/roster?season=${season}&side=${side}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const json: ApiResp = await res.json();
        if (!cancel) setData(json);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? 'Failed to load roster');
      }
    })();
    return () => { cancel = true; };
  }, [season, side]);

  const order = sidePositions(side);
  const rows: Row[] = React.useMemo(() => {
    const base = data?.rows ?? order.map(p => ({ pos: p, players: [] }));
    const term = q.trim().toLowerCase();
    if (!term) return base;
    return base.map(r => ({
      pos: r.pos,
      players: r.players.filter(p => p.name.toLowerCase().includes(term)),
    }));
  }, [data, order, q]);

  return (
    <div className="h-full flex flex-col rounded-xl border border-slate-700 bg-[#0b1220]/70 backdrop-blur">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <div className="inline-flex rounded-md overflow-hidden border border-slate-600">
          <button
            onClick={() => onSideChange('OFF')}
            className={`px-3 py-1 text-sm ${side==='OFF' ? 'bg-slate-200 text-slate-900' : 'bg-transparent text-slate-300 hover:bg-slate-800'}`}
          >
            Offense
          </button>
          <button
            onClick={() => onSideChange('DEF')}
            className={`px-3 py-1 text-sm ${side==='DEF' ? 'bg-slate-200 text-slate-900' : 'bg-transparent text-slate-300 hover:bg-slate-800'}`}
          >
            Defense
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          <div className="text-xs text-slate-400">Season {season}</div>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 min-h-0 overflow-auto p-2 pr-3">
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.pos} className="flex items-center gap-3">
              <div className="w-12 text-right text-sm text-slate-300 font-medium">{row.pos}</div>
              <div className="flex-1 flex flex-wrap gap-2">
                {row.players.length === 0 ? (
                  <div className="text-xs text-slate-500">—</div>
                ) : row.players.map(p => <PlayerChip key={p.id} name={p.name} ovr={p.ovr} cls={p.cls} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer with + button */}
      <div className="px-3 py-2 border-t border-slate-700 flex items-center">
        <button
          onClick={onAddClick}
          className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-slate-200 text-slate-900 text-sm hover:bg-white"
          title="Add Player"
        >
          <span className="text-lg leading-none">＋</span> Add Player
        </button>
        {err && <div className="ml-auto text-xs text-red-400">{err}</div>}
      </div>
    </div>
  );
}

function PlayerChip({ name, ovr, cls }: { name: string; ovr: number; cls: string }) {
  const band = ovrBand(ovr);
  return (
    <div className="group relative select-none" title={`${name} • ${cls} • OVR ${ovr}`}>
      <div className={`h-6 w-6 rounded-full ring-2 ring-slate-300/60 shadow-sm ${band}`} />
      <span className="absolute -top-1 -right-1 text-[10px] px-[3px] py-[1px] rounded bg-slate-900 border border-slate-700 text-slate-300">
        {cls}
      </span>
      <div className="absolute z-10 hidden group-hover:block left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap text-xs px-2 py-1 rounded bg-slate-900/95 border border-slate-700 text-slate-200 shadow">
        {name} · OVR {ovr}
      </div>
    </div>
  );
}