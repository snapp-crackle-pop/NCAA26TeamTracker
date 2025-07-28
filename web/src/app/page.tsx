'use client';

import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { PlayerDBPanel } from '@/components/PlayerDBPanel';
import { AddPlayerModal } from '@/components/AddPlayerModal';
import { FormationCanvas } from '@/components/FormationCanvas';
import { FormationControls, type ViewMode } from '@/components/FormationControls';
import { TimelineControl } from '@/components/TimelineControl';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GearIcon } from '@/components/Icons';

type Formation = { id: string; side: 'OFF'|'DEF'|string; name: string; variant: string | null };

export default function Home() {
  const [baseSeason, setBaseSeason] = React.useState(2026);
  const [t, setT] = React.useState(0);
  const season = baseSeason + t;

  const [openAdd, setOpenAdd] = React.useState(false);
  const [formationId, setFormationId] = React.useState<string|undefined>();
  const [side, setSide] = React.useState<'OFF'|'DEF'>('OFF');
  const [view, setView] = React.useState<ViewMode>('starters');

  const [formations, setFormations] = React.useState<Formation[]>([]);
  React.useEffect(() => {
    let abort = false;
    fetch('/api/formations')
      .then(r => r.json())
      .then((rows: Formation[]) => { if (!abort) setFormations(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!abort) setFormations([]); });
    return () => { abort = true; };
  }, []);

  return (
    <div className="h-dvh flex flex-col">
      {/* Top bar */}
      <div className="app-topbar flex items-center justify-between gap-3 px-4 py-2">
        <div className="font-semibold tracking-wide">NCAA26 Team Tracker</div>
        <div className="flex-1 flex justify-center">
          <FormationControls
            formations={formations}
            side={side}
            onSideChange={setSide}
            formationId={formationId}
            onFormationChange={setFormationId}
            view={view}
            onViewChange={setView}
          />
        </div>
        <ThemeToggle />
      </div>

      {/* Split panes — explicit height + min-h-0 so children can grow */}
      <PanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 px-3 py-3 gap-3"
        style={{ height: 'calc(100dvh - 48px)' }} // ~topbar height; adjust if needed
      >
        {/* Left DB */}
        <Panel defaultSize={28} minSize={20} maxSize={45} className="min-h-0">
          <div className="h-full min-h-0 sketch-panel p-2">
            <PlayerDBPanel
              season={baseSeason}
              onSeasonChange={setBaseSeason}
              onAddClick={() => setOpenAdd(true)}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="group w-2 relative">
          <div className="absolute inset-y-8 left-1/2 -translate-x-1/2 w-[3px] rounded bg-[var(--chalk-stroke)]/35 group-hover:bg-[var(--chalk-stroke)]/60 transition-colors" />
        </PanelResizeHandle>

        {/* Right board */}
        <Panel className="min-h-0">
          <div className="h-full min-h-0 sketch-panel flex flex-col">
            <div className="relative flex-1 min-h-0 rounded-[14px]">
              <div className="absolute inset-0">
                <FormationCanvas formationId={formationId} season={season} view={view} />
              </div>
              <button className="fab absolute bottom-3 right-3 p-2" title="Settings">
                <GearIcon className="w-5 h-5" />
              </button>
            </div>
            <TimelineControl baseSeason={baseSeason} timeOffset={t} onOffsetChange={setT} />
          </div>
        </Panel>
      </PanelGroup>

      {openAdd && <AddPlayerModal onClose={() => setOpenAdd(false)} season={season} />}
    </div>
  );
}