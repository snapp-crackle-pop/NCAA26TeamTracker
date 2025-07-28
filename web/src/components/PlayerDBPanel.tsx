'use client';
import * as React from 'react';
import { PlusIcon } from './Icons';

type PlayerRow = {
    id: string;
    position: string;
    name: string;
    nameAbbr?: string;     // from API
    classYear: string | null;
    heightIn?: number | null;
    weightLb?: number | null;
    ovr?: number | null;
  };


function toFtIn(h?: number | null) {
    if (h == null) return '';
    const ft = Math.floor(h / 12);
    const inch = h % 12;
    return `${ft}'${inch}"`;
    }
  

export function PlayerDBPanel({
  season,
  onAddClick,
  onSeasonChange,
}: {
  season: number;
  onAddClick: () => void;
  onSeasonChange: (s: number) => void;
}) {
  const [players, setPlayers] = React.useState<PlayerRow[]>([]);

  React.useEffect(() => {
    fetch('/api/players?season=' + season)
      .then(r => r.json())
      .then((rows) => { if (Array.isArray(rows)) setPlayers(rows); })
      .catch(() => setPlayers([]));
  }, [season]);

  return (
    <div className="h-full flex flex-col">
      {/* Season register */}
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <div className="text-xs opacity-70 tracking-wide uppercase">Season</div>
        <div className="flex items-center gap-1">
          <button className="btn" onClick={() => onSeasonChange(season - 1)}>-</button>
          <div className="min-w-16 text-center font-semibold">{season}</div>
          <button className="btn" onClick={() => onSeasonChange(season + 1)}>+</button>
        </div>
      </div>

      {/* Roster list */}
      <div className="flex-1 overflow-auto mt-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 backdrop-blur bg-[var(--panel)] border-b border-[var(--chalk-stroke)]/40">
            <tr className="[&>th]:px-2 [&>th]:py-1 text-left">
            <th className="w-12 text-left">Pos</th>
            <th className="text-left">Name</th>
            <th className="w-20 text-right">Ht</th>
            <th className="w-20 text-right">Wt</th>
            <th className="w-14 text-right">OVR</th>
                        </tr>
          </thead>
          <tbody className="[&>tr:nth-child(odd)]:bg-white/3">
            {players.map(p => (
              <tr key={p.id} className="[&>td]:px-2 [&>td]:py-1">
                <td className="text-left">{p.position}</td>
                <td className="text-left">{p.nameAbbr ?? p.name}</td>
                <td className="text-right tabular-nums">{toFtIn(p.heightIn)}</td>
                <td className="text-right tabular-nums">{p.weightLb ?? ''}</td>
                <td className="text-right tabular-nums">{p.ovr ?? '—'}</td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center opacity-70">
                  No players for {season}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add player */}
      <div className="hidden">
        <button onClick={onAddClick} className="btn w-full flex items-center justify-center gap-2">
          <PlusIcon className="w-4 h-4" /> Add Player
        </button>
      </div>
    </div>
  );
}