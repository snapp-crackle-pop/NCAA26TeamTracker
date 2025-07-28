'use client';

import * as React from 'react';
import { Plus, Search } from 'lucide-react';
import { ovrBand, sidePositions } from '@/lib/positions';

type Row = { pos: string; players: { id: string; name: string; ovr: number; cls: string }[] };
type ApiResp = { side: 'OFF'|'DEF'; season: number; rows: Row[] };

export function RosterDataTable({
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
    <div className="h-full flex flex-col rounded-xl border border-slate-700/70 bg-slate-900/40 backdrop-blur">
      {/* Toolbar */}
      <div className="h-12 px-3 flex items-center gap-2 border-b border-slate-700/70">
        {/* Off/Def segmented */}
        <div className="inline-flex rounded-md overflow-hidden border border-slate-700/70">
          <button
            onClick={() => onSideChange('OFF')}
            className={`px-3 py-1.5 text-sm transition-colors ${side==='OFF' ? 'bg-slate-200 text-slate-900' : 'bg-transparent text-slate-300 hover:bg-slate-800/60'}`}
          >
            Offense
          </button>
          <button
            onClick={() => onSideChange('DEF')}
            className={`px-3 py-1.5 text-sm transition-colors ${side==='DEF' ? 'bg-slate-200 text-slate-900' : 'bg-transparent text-slate-300 hover:bg-slate-800/60'}`}
          >
            Defense
          </button>
        </div>

        {/* Search */}
        <div className="ml-auto relative">
          <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players"
            className="w-44 pl-7 pr-2 py-1.5 bg-slate-900/70 border border-slate-700 rounded outline-none focus:ring-1 focus:ring-slate-400 text-sm"
          />
        </div>

        <button
          onClick={onAddClick}
          className="ml-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-sky-500 text-slate-900 text-sm hover:bg-sky-400"
          title="Add Player"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-900/70 backdrop-blur border-b border-slate-700/70">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-300 w-16">Pos</th>
              <th className="text-left px-3 py-2 font-medium text-slate-300">Players</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.pos} className={idx % 2 ? 'bg-slate-900/30' : ''}>
                <td className="px-3 py-2 text-slate-300 font-medium">{row.pos}</td>
                <td className="px-3 py-2">
                  {row.players.length === 0 ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {row.players.map((p) => (
                        <PlayerChip key={p.id} name={p.name} ovr={p.ovr} cls={p.cls} />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="h-10 px-3 flex items-center justify-between border-t border-slate-700/70 text-xs text-slate-400">
        <span>Season {season}</span>
        {err && <span className="text-red-300">{err}</span>}
      </div>
    </div>
  );
}

function PlayerChip({ name, ovr, cls }: { name: string; ovr: number; cls: string }) {
  const band = ovrBand(ovr); // Tailwind bg-* class
  return (
    <div className="group relative select-none">
      <div className={`h-6 w-6 rounded-full ring-2 ring-slate-300/60 shadow-sm ${band}`} title={`${name} • ${cls} • OVR ${ovr}`} />
      <span className="absolute -top-1 -right-1 text-[10px] px-[3px] py-[1px] rounded bg-slate-900 border border-slate-700 text-slate-300">
        {cls}
      </span>
      <div className="absolute z-10 hidden group-hover:block left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap text-[11px] px-2 py-1 rounded bg-slate-900/95 border border-slate-700 text-slate-100 shadow">
        {name} · OVR {ovr}
      </div>
    </div>
  );
}