'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type ViewMode = 'starters' | 'backups' | 'weighted';
type Formation = { id: string; side: 'OFF'|'DEF'|string; name: string; variant: string | null };

export function FormationControls({
  formations,
  side,
  onSideChange,
  formationId,
  onFormationChange,
  view,
  onViewChange,
}: {
  formations: Formation[];
  side: 'OFF'|'DEF';
  onSideChange: (s: 'OFF'|'DEF') => void;
  formationId?: string;
  onFormationChange: (id?: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  const list = useMemo(
    () => formations.filter(f => (f.side as string).toUpperCase() === side),
    [formations, side]
  );
  // ensure selection is valid when side changes
  useEffect(() => {
    if (!list.length) { onFormationChange(undefined); return; }
    if (!formationId || !list.find(f => f.id === formationId)) onFormationChange(list[0].id);
  }, [side, list.map(f=>f.id).join(',' /* deps key */)]); // eslint-disable-line

  const current = useMemo(
    () => list.find(f => f.id === formationId) ?? list[0],
    [list, formationId]
  );

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12 }}>
      <HoverMenu
        label={`< ${side === 'OFF' ? 'OFFENSE' : 'DEFENSE'} >`}
        items={[
          { label: 'OFFENSE', onClick: () => onSideChange('OFF') },
          { label: 'DEFENSE', onClick: () => onSideChange('DEF') },
        ]}
      />
      <HoverMenu
        label={current ? `${current.name}${current.variant ? `: ${current.variant}` : ''}` : '(none)'}
        items={list.map(f => ({
          label: `${f.name}${f.variant ? `: ${f.variant}` : ''}`,
          onClick: () => onFormationChange(f.id),
        }))}
      />
      <HoverMenu
        label={view === 'starters' ? 'Starters ▾' : view === 'backups' ? 'Backups ▾' : 'Weighted ▾'}
        items={[
          { label: 'Starters', onClick: () => onViewChange('starters') },
          { label: 'Backups',  onClick: () => onViewChange('backups') },
          { label: 'Weighted depth', onClick: () => onViewChange('weighted') },
        ]}
      />
    </div>
  );
}

function HoverMenu({
  label,
  items,
  align = 'left',
}: {
  label: string;
  items: { label: string; onClick: () => void }[];
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      const node = ref.current;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: 22,
    background: 'var(--background)',
    border: '1px solid var(--chalk-stroke)',
    borderRadius: 8,
    padding: 6,
    zIndex: 30,
    minWidth: 200,
    display: open ? 'block' : 'none',
    ...(align === 'right' ? { right: 0 } : { left: 0 }),
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(v => !v); }}
        style={{ fontWeight: 700, letterSpacing: 1, cursor: 'pointer', userSelect: 'none' }}
      >
        {label}
      </div>
      <div style={menuStyle} onPointerDown={(e) => e.stopPropagation()}>
        {items.map((it, idx) => (
          <div
            key={idx}
            onClick={() => { setOpen(false); it.onClick(); }}
            style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in oklab, var(--foreground) 8%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}