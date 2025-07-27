'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export default function Home() {
  return (
    <main className="h-screen">
      <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-700">
        <div className="flex gap-2">
          <select className="bg-neutral-800 px-2 py-1 rounded"> 
            <option>Registry Year (t=0)</option>
          </select>
        </div>
        <div className="text-xl tracking-wide">NCAA26TeamTracker</div>
        <div className="flex gap-3">
          <button className="bg-neutral-800 px-3 py-1 rounded">Views</button>
        </div>
      </header>

      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <div className="h-[calc(100vh-48px)] p-3">
            {/* Roster Board placeholder */}
            <button className="fixed left-4 bottom-4 size-12 rounded-full bg-neutral-800 text-2xl">+</button>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-neutral-700" />
        <Panel minSize={40}>
          <div className="h-[calc(100vh-48px)] p-3">
            {/* Formation Board + timeline placeholders */}
            <div className="flex items-center justify-center h-full border border-neutral-700 rounded">
              Formation canvas
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </main>
  );
}