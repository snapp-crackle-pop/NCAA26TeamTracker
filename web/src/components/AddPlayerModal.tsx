'use client';

import * as React from 'react';
import { ModalPortal } from '@/components/ModalPortal';

export function AddPlayerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      // TODO: POST to /api/players
      // await fetch('/api/players', { method: 'POST', body: form });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100]">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[min(92vw,760px)] max-h-[80vh] overflow-auto
                        bg-[var(--panel)] border border-[var(--panel-border)]
                        rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Add Player</h2>
            <button
              onClick={onClose}
              className="px-2 py-1 rounded-md border border-[var(--panel-border)] hover:bg-black/5 dark:hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm mb-1">Name</label>
              <input name="name" required className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm mb-1">Position</label>
              <select name="position" required className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                {['QB','HB','FB','WR','TE','LT','LG','C','RG','RT','LEDG','REDG','DT','SAM','MIKE','WILL','CB','FS','SS','K','P'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Archetype</label>
              <input name="archetype" placeholder="e.g., Field General" className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm mb-1">Height (in)</label>
              <input name="height" type="number" min={55} max={90} className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm mb-1">Weight (lb)</label>
              <input name="weight" type="number" min={120} max={380} className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" />
            </div>

            <div className="col-span-2 mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-md border border-[var(--panel-border)] hover:bg-black/5 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-3 py-2 rounded-md border border-[var(--panel-border)] bg-sky-600/90 text-white hover:bg-sky-600 disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save Player'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

export default AddPlayerModal;