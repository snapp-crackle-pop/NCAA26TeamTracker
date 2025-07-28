'use client';

import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ChalkRosterTable } from '@/components/ChalkRosterTable';
import ChalkFormation from '@/components/ChalkFormation';
import { AddPlayerModal } from '@/components/AddPlayerModal';

export default function Home() {
  const [open, setOpen] = React.useState(false);
  const [side, setSide] = React.useState<'OFF' | 'DEF'>('OFF');
  const [season, setSeason] = React.useState<number>(new Date().getFullYear());

  return (
    <main className="h-screen overflow-hidden relative">
      {/* Top bar (above everything) */}
      <header className="h-12 flex items-center justify-between px-3 border-b border-[var(--panel-border)] bg-[var(--panel)] z-40 relative">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="bubble w-9 h-9 text-sm"
            title="Add Player"
          >
            +
          </button>
          <div className="ml-3 text-sm opacity-80">NCAA26TeamTracker</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-75">Year</span>
            <input
              type="number"
              value={season}
              onChange={(e) =>
                setSeason(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))
              }
              className="w-24 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-sm"
            />
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Panels area */}
      <PanelGroup direction="horizontal" className="h-[calc(100vh-48px)] overflow-hidden">
        {/* LHS – roster, scrolls internally */}
        <Panel defaultSize={36} minSize={24}>
          <div className="h-full p-3">
            <div className="h-full flex flex-col min-h-0 overflow-hidden">
              <ChalkRosterTable side={side} season={season} />
            </div>
          </div>
        </Panel>

        {/* Resizer, visible and above content */}
        <PanelResizeHandle className="resizer relative z-30">
          <div className="grip" />
        </PanelResizeHandle>

        {/* RHS – formation, panning/zooming */}
        <Panel minSize={36}>
          <div className="h-full p-3 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0">
              <ChalkFormation
                season={season}
                side={side}
                onSideChange={setSide}
                initialView="starters"
              />
            </div>
          </div>
        </Panel>
      </PanelGroup>

      {/* Modal mounted at top of DOM */}
      <AddPlayerModal open={open} onClose={() => setOpen(false)} />
    </main>
  );
}