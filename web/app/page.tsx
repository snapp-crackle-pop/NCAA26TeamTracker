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

type Formation = {
  id: string;
  side: 'OFF' | 'DEF' | string;
  name: string;
  variant: string | null;
};

export default function Home() {
  // Registry season (t = 0)
  const [baseSeason, setBaseSeason] = React.useState(2026);
  // Timeline offset
  const [t, setT] = React.useState(0);
  const season = baseSeason + t;

  // UI state
  const [openAdd, setOpenAdd] = React.useState(false);
  const [formationId, setFormationId] = React.useState<string | undefined>();
  const [side, setSide] = React.useState<'OFF' | 'DEF'>('OFF');
  const [view, setView] = React.useState<ViewMode>('starters');

  // Formations list from backend
  const [formations, setFormations] = React.useState<Formation[]>([]);
  React.useEffect(() => {
    let abort = false;
    fetch('/api/formations')
      .then((r) => r.json())
      .then((rows: Formation[]) => {
        if (!abort) setFormations(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!abort) setFormations([]);
      });
    return () => {
      abort = true;
    };
  }, []);

  return (
    // Lock viewport: no page scrolling
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Slim top bar */}
      <div className="app-topbar flex items-center justify-between gap-3 px-4 py-2">
        <div className="font-semibold tracking-wide">NCAA26 Team Tracker</div>
        <ThemeToggle />
      </div>

      {/* Split layout fills the rest */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0 px-3 py-3 gap-3">
        {/* Left: DB panel (internal scroll only) */}
        <Panel defaultSize={28} minSize={20} maxSize={45} className="min-h-0">
          <div className="h-full min-h-0 sketch-panel p-2">
            <PlayerDBPanel
              season={baseSeason}
              onSeasonChange={setBaseSeason}
              onAddClick={() => setOpenAdd(true)}
            />
          </div>
        </Panel>

        {/* Divider */}
        <PanelResizeHandle className="group w-2 relative">
          <div className="absolute inset-y-8 left-1/2 -translate-x-1/2 w-[3px] rounded bg-[var(--chalk-stroke)]/35 group-hover:bg-[var(--chalk-stroke)]/60 transition-colors" />
        </PanelResizeHandle>

        {/* Right: scene with overlays */}
        <Panel className="min-h-0">
          {/* Stacking context + clipping so overlays stay inside */}
          <div className="h-full min-h-0 sketch-panel relative overflow-hidden">
            {/* Scene (ensure its root has z-10 inside the component) */}
            <FormationCanvas formationId={formationId} season={season} view={view} />

            {/* TOP overlay: OFF/DEF + formation + view (inline absolute to avoid utility issues) */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                pointerEvents: 'none',
              }}
            >
              <div className="overlay-card px-3 py-2 text-sm" style={{ pointerEvents: 'auto' }}>
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
            </div>

            {/* BOTTOM overlay: timeline pinned to bottom (inline absolute) */}
            <div
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: 8,
                zIndex: 50,
                pointerEvents: 'none',
              }}
            >
              <div className="overlay-card" style={{ pointerEvents: 'auto' }}>
                <TimelineControl baseSeason={baseSeason} timeOffset={t} onOffsetChange={setT} />
              </div>
            </div>

            {/* Settings button */}
            <button
              className="fab p-2"
              title="Settings"
              style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 51 }}
            >
              <GearIcon className="w-5 h-5" />
            </button>
          </div>
        </Panel>
      </PanelGroup>

      {openAdd && <AddPlayerModal onClose={() => setOpenAdd(false)} season={season} />}
    </div>
  );
}