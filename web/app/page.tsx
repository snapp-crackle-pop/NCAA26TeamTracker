'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as React from 'react';
import { AddPlayerModal } from '@/components/AddPlayerModal';
import { FormationControls, type ViewMode } from '@/components/FormationControls';
import { FormationCanvas } from '@/components/FormationCanvas';

type Formation = { id: string; side: 'OFF'|'DEF'|string; name: string; variant: string | null };

export default function Home() {
  const [open, setOpen] = React.useState(false);
  const [registryYear, setRegistryYear] = React.useState<number>(new Date().getFullYear());
  const [formations, setFormations] = React.useState<Formation[]>([]);
  const [side, setSide] = React.useState<'OFF'|'DEF'>('OFF');
  const [formationId, setFormationId] = React.useState<string | undefined>(undefined);
  const [view, setView] = React.useState<ViewMode>('starters');

  React.useEffect(() => {
    fetch('/api/formations').then(r => r.json()).then((rows: Formation[]) => {
      setFormations(rows);
      // pick a default formation (first offense)
      const firstOff = rows.find(f => f.side === 'OFF') ?? rows[0];
      if (firstOff) {
        setSide((firstOff.side as any) ?? 'OFF');
        setFormationId(firstOff.id);
      }
    });
  }, []);

  return (
    <main className="h-screen">
      <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <label className="text-sm">Registry Year (t=0)</label>
          <input
            type="number"
            className="bg-neutral-800 px-2 py-1 rounded w-28"
            value={registryYear}
            onChange={e => setRegistryYear(Number(e.target.value))}
          />
        </div>
        <div className="text-xl tracking-wide">NCAA26TeamTracker</div>
        <div className="flex gap-3">
          {/* Placeholder for future global actions */}
        </div>
      </header>

      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <div className="h-[calc(100vh-48px)] p-3 relative">
            {/* Roster Board placeholder (we'll add list soon) */}
            <button
              onClick={() => setOpen(true)}
              className="fixed left-4 bottom-4 size-12 rounded-full bg-neutral-800 text-2xl"
              title="Add Player"
            >+</button>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-neutral-700" />
        <Panel minSize={40}>
          <div className="h-[calc(100vh-48px)] p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <FormationControls
                formations={formations}
                side={side}
                formationId={formationId}
                view={view}
                onSideChange={(s) => { setSide(s); /* formation corrected inside component */ }}
                onFormationChange={setFormationId}
                onViewChange={setView}
              />
              <div className="text-sm text-neutral-400">
                Season: {registryYear} • View: {view}
              </div>
            </div>

            <div className="flex-1">
              <FormationCanvas formationId={formationId} season={registryYear} view={view} />
            </div>
          </div>
        </Panel>
      </PanelGroup>

      <AddPlayerModal open={open} onClose={() => setOpen(false)} registryYear={registryYear} />
    </main>
  );
}