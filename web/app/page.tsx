'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as React from 'react';
import { AddPlayerModal } from '@/components/AddPlayerModal';

export default function Home() {
  const [open, setOpen] = React.useState(false);
  const [registryYear, setRegistryYear] = React.useState<number>(new Date().getFullYear());

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
          <button className="bg-neutral-800 px-3 py-1 rounded">Views</button>
        </div>
      </header>

      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <div className="h-[calc(100vh-48px)] p-3 relative">
            {/* Roster Board placeholder */}
            <button
              onClick={() => setOpen(true)}
              className="fixed left-4 bottom-4 size-12 rounded-full bg-neutral-800 text-2xl"
              title="Add Player"
            >+</button>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-neutral-700" />
        <Panel minSize={40}>
          <div className="h:[calc(100vh-48px)] p-3">
            <div className="flex items-center justify-center h-full border border-neutral-700 rounded">
              Formation canvas
            </div>
          </div>
        </Panel>
      </PanelGroup>

      <AddPlayerModal open={open} onClose={() => setOpen(false)} registryYear={registryYear} />
    </main>
  );
}