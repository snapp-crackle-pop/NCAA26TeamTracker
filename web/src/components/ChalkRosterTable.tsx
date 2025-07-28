'use client';

import * as React from 'react';
import { Plus, Search } from 'lucide-react';
import { ovrBand, sidePositions } from '@/lib/positions';

type Row = { pos: string; players: { id: string; name: string; ovr: number; cls: string }[] };
type ApiResp = { side: 'OFF'|'DEF'; season: number; rows: Row[] };

export function ChalkRosterTable({
  season, side, onSideChange, onAddClick,
}: {
  season: number;
  side: 'OFF'|'DEF';
  onSideChange: (s: 'OFF'|'DEF') => void;
  onAddClick: () => void;
}) {
  const [data, setData] = React.useState<ApiResp | null>(null);
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      const res = await fetch(`/api/roster?season=${season}&side=${side}`, { cache: 'no-store' });
      const json: ApiResp = await res.json();
      if (!cancel) setData(json);
    })();
    return () => { cancel = true; };
  }, [season, side]);

  const order = sidePositions(side);
  const rows: Row[] = React.useMemo(() => {
    const base = data?.rows ?? order.map(p => ({ pos: p, players: [] }));
    const term = q.trim().toLowerCase();
    if (!term) return base;
    return base.map(r => ({ pos: r.pos, players: r.players.filter(p => p.name.toLowerCase().includes(term)) }));
  }, [data, order, q]);

  return (
    <div className="h-full flex flex-col scribble-surface relative">
      {/* Title pill like “Season / Roster” */}
      <div className="sticky top-0 z-10">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200/25 bg-slate-900/50 backdrop-blur">
          <div className="inline-flex rounded-full overflow-hidden border border-slate-200/40">
            <button
              onClick={() => onSideChange('OFF')}
              className={`px-3 py-1 text-sm ${side==='OFF' ? 'bg-slate-200 text-slate-900' : 'text-slate-200 hover:bg-slate-800/50'}`}
            >OFFENSE</button>
            <button
              onClick={() => onSideChange('DEF')}
              className={`px-3 py-1 text-sm ${side==='DEF' ? 'bg-slate-200 text-slate-900' : 'text-slate-200 hover:bg-slate-800/50'}`}
            >DEFENSE</button>
          </div>

          <div className="ml-auto relative">
            <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-70" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search"
              className="w-40 pl-7 pr-2 py-1 rounded bg-slate-900/60 border border-slate-200/30 outline-none focus:ring-1 focus:ring-slate-200/60 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Grid of rows */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm border-separate" style={{ borderSpacing: '0 10px' }}>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pos}>
                <td className="w-14 align-top pr-2 text-right opacity-90">{row.pos}</td>
                <td className="py-1">
                  {row.players.length === 0 ? (
                    <span className="opacity-60">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {row.players.map((p) => (
                        <Dot key={p.id} name={p.name} ovr={p.ovr} cls={p.cls} />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Big + bubble (bottom-left) */}
      <button
        onClick={onAddClick}
        className="bubble absolute left-3 bottom-3 w-12 h-12"
        title="Add Player"
      >
        <Plus />
      </button>
    </div>
  );
}

function Dot({ name, ovr, cls }: { name: string; ovr: number; cls: string }) {
  const band = ovrBand(ovr); // Tailwind bg-* class
  return (
    <div className="group relative">
      <div className={`h-6 w-6 rounded-full dot ${band}`} title={`${name} • ${cls} • OVR ${ovr}`} />
      <span className="absolute -top-1 -right-1 text-[10px] px-[3px] py-[1px] rounded bg-slate-900/90 border border-slate-200/30">
        {cls}
      </span>
      <div className="absolute z-10 hidden group-hover:block left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap text-[11px] px-2 py-1 rounded bg-slate-900/95 border border-slate-200/25 shadow">
        {name} · OVR {ovr}
      </div>
    </div>
  );
}