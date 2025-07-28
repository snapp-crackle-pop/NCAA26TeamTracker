'use client';

import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { PlayerDBPanel } from '@/components/PlayerDBPanel';
import { AddPlayerModal } from '@/components/AddPlayerModal';
import { FormationCanvas, type FormationCanvasHandle } from '@/components/FormationCanvas';
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

  const canvasRef = React.useRef<FormationCanvasHandle | null>(null);

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* top bar */}
      <div className="app-topbar flex items-center justify-between gap-3 px-4 py-2">
        <div className="font-semibold tracking-wide">NCAA26 Team Tracker</div>
        <ThemeToggle />
      </div>

      <PanelGroup direction="horizontal" className="flex-1 min-h-0 px-3 py-3 gap-3">
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

        {/* Right scene */}
        <Panel className="min-h-0">
          <div className="h-full min-h-0 sketch-panel relative overflow-hidden">
            {/* scene */}
            <FormationCanvas ref={canvasRef} formationId={formationId} season={season} view={view} />

            {/* TOP-CENTER controls */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
              <div className="overlay-card px-3 py-2 text-sm">
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

            {/* TOP-RIGHT camera buttons (overlay; guaranteed visible) */}
            <div
              className="z-50"
              style={{ position:'absolute', top:12, right:12, display:'flex', gap:8 }}
            >
              <button className="btn text-sm w-8 h-8" onClick={() => canvasRef.current?.zoomIn()}>＋</button>
              <button className="btn text-sm w-8 h-8" onClick={() => canvasRef.current?.zoomOut()}>－</button>
              <button className="btn text-sm w-8 h-8" onClick={() => canvasRef.current?.fit()}>⟲</button>
            </div>

            {/* BOTTOM timeline — force absolute bottom/left/right via inline styles */}
<div
  style={{
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 16,
    zIndex: 60,            // above the scene
    pointerEvents: 'none', // let you drag the canvas where not on the card
  }}
>
  <div className="overlay-card" style={{ pointerEvents: 'auto' }}>
    <TimelineControl baseSeason={baseSeason} timeOffset={t} onOffsetChange={setT} />
  </div>
</div>

            {/* Settings */}
            <button className="fab absolute bottom-3 right-3 p-2 z-50" title="Settings">
              <GearIcon className="w-5 h-5" />
            </button>
          </div>
        </Panel>
      </PanelGroup>

      {openAdd && <AddPlayerModal onClose={() => setOpenAdd(false)} season={season} />}
    </div>
  );
}