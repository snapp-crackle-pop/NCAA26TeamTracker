'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Archetype = {
  id: string;
  name: string;
  position: string;
  subsetKeys: string[]; // JSON string[] on the server
};

type Props = {
  open: boolean;
  season: number;
  onClose: () => void;
  onCreated?: () => void; // optional callback to refresh lists/UI
};

const clamp99 = (n: number) => Math.max(0, Math.min(99, n | 0));
const toInches = (ft: number, inch: number) => ft * 12 + inch;

export default function AddPlayerModal({ open, season, onClose, onCreated }: Props) {
  // ---- mount guard for portals (avoids hydration mismatch) ----
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ---- close on ESC + lock scroll while open ----
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // ---------- base fields ----------
  const [pos, setPos] = useState('WR');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [ft, setFt] = useState(6);
  const [inch, setInch] = useState(0);
  const [wt, setWt] = useState(200);
  const [enroll, setEnroll] = useState(season);
  const [redshirt, setRedshirt] = useState(false);

  // backend-required meta (kept simple defaults)
  const [sourceType, setSourceType] = useState<'Recruiting' | 'Transfer Portal' | 'Existing Roster'>('Existing Roster');
  const [devTrait, setDevTrait] = useState<'Normal' | 'Impact' | 'Star' | 'Elite'>('Normal');
  const [devCap, setDevCap] = useState<number | ''>('');

  // ---------- archetypes + subset ----------
  const [archs, setArchs] = useState<Archetype[]>([]);
  const [archId, setArchId] = useState<string | null>(null);
  const activeArch = useMemo(() => archs.find(a => a.id === archId) ?? null, [archs, archId]);

  // Stable empty array to avoid dependency identity churn
  const EMPTY_KEYS = useRef<string[]>([]).current;
  const ratingKeys = useMemo(() => activeArch?.subsetKeys ?? EMPTY_KEYS, [activeArch, EMPTY_KEYS]);

  // Ratings (subset) state
  const [subset, setSubset] = useState<Record<string, number | ''>>({});

  // Fetch archetypes when position changes (only while open)
  useEffect(() => {
    if (!open) return;
    let abort = false;

    (async () => {
      try {
        // Prefer position-filtered route; fall back to unfiltered
        let res = await fetch(`/api/archetypes?position=${encodeURIComponent(pos)}`);
        if (!res.ok) res = await fetch('/api/archetypes');
        if (!res.ok) throw new Error('archetype fetch failed');

        const rows = (await res.json()) as Archetype[];
        if (abort) return;

        // If server returns mixed positions, filter to current position when possible
        const hasPosition = rows.some(r => r.position);
        const list = hasPosition ? rows.filter(r => r.position === pos) : rows;
        setArchs(list);
        setArchId(list[0]?.id ?? null);
      } catch (e) {
        if (!abort) {
          setArchs([]);
          setArchId(null);
        }
      }
    })();

    return () => {
      abort = true;
    };
  }, [open, pos]);

  // Reset subset fields ONLY when the chosen archetype changes
  useEffect(() => {
    if (!open) return;
    const next: Record<string, number | ''> = {};
    for (const k of ratingKeys) next[k] = '';
    // Only update if the keys actually changed
    setSubset(prev => {
      const prevKeys = Object.keys(prev);
      if (prevKeys.length === ratingKeys.length && prevKeys.every((k, i) => k === ratingKeys[i])) {
        return prev; // no state change
      }
      return next;
    });
  }, [open, archId]); // <— key fix: depend on archId, not on ratingKeys identity

  function setSub(key: string, value: string) {
    setSubset(prev => ({
      ...prev,
      [key]: value === '' ? '' : clamp99(Number(value)),
    }));
  }

  // ---------- submit ----------
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Clean subset payload (only numbers 0..99)
      const clean: Record<string, number> = {};
      for (const k of ratingKeys) {
        const v = subset[k];
        if (v !== '' && Number.isFinite(Number(v))) clean[k] = clamp99(Number(v));
      }

      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Server computes OVR; we do not send it.
          name: `${first.trim()} ${last.trim()}`.trim(),
          position: pos,
          archetypeId: archId,
          heightIn: toInches(Number(ft), Number(inch)),
          weightLb: Number(wt),
          sourceType,
          devTrait,
          devCap: devCap === '' ? null : Number(devCap),
          enrollmentYear: Number(enroll),
          redshirt,
          season,          // snapshot season
          subset: clean,   // used by server to compute ratings/OVR
        }),
      });

      if (!res.ok) throw new Error(`POST /api/players ${res.status}`);
      onCreated?.();
      onClose();
    } catch (err) {
      console.error('AddPlayerModal submit failed:', err);
      alert('Could not add player. Check console for details.');
    } finally {
      setSaving(false);
    }
  }

  // ---- render ----
  if (!mounted || !open) return null;

  // Inline styles to ensure immunity from global CSS & transforms
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(2px)',
  };

  const cardStyle: React.CSSProperties = {
    width: 'min(880px, 96vw)',
    maxHeight: '90vh',
    overflow: 'auto',
    borderRadius: 16,
    background: '#111',
    color: '#f3f4f6',
    boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const headerFooterStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 20px',
    position: 'sticky',
    background: 'rgba(17,17,17,0.95)',
    backdropFilter: 'blur(2px)',
  };

  const sectionStyle: React.CSSProperties = { padding: '16px 20px' };
  const labelColStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    background: '#1f2937',
    border: '1px solid #374151',
    color: '#e5e7eb',
  };
  const subgrid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

  return createPortal(
    <div style={overlayStyle} onClick={onClose} aria-modal="true" role="dialog">
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={cardStyle}>
        {/* Header */}
        <div style={{ ...headerFooterStyle, top: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Add Player · {season}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '4px 8px', borderRadius: 6 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={sectionStyle}>
          {/* Position + Archetype */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Position</span>
              <select value={pos} onChange={(e) => setPos(e.target.value)} style={inputStyle}>
                {[
                  'QB', 'RB', 'FB', 'WR', 'TE',
                  'LT', 'LG', 'C', 'RG', 'RT',
                  'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB',
                  'CB', 'FS', 'SS', 'K', 'P',
                ].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Archetype</span>
              <select
                value={archId ?? ''}
                onChange={(e) => setArchId(e.target.value || null)}
                style={inputStyle}
              >
                {archs.length === 0 && <option value="">No archetypes</option>}
                {archs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Identity / Physicals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>First Name</span>
              <input autoFocus value={first} onChange={(e) => setFirst(e.target.value)} style={inputStyle} />
            </label>

            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Last Name</span>
              <input value={last} onChange={(e) => setLast(e.target.value)} style={inputStyle} />
            </label>

            <div style={subgrid2}>
              <label style={labelColStyle}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Height (ft)</span>
                <input
                  type="number"
                  value={ft}
                  onChange={(e) => setFt(Number(e.target.value))}
                  style={inputStyle}
                />
              </label>
              <label style={labelColStyle}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Height (in)</span>
                <input
                  type="number"
                  value={inch}
                  onChange={(e) => setInch(Number(e.target.value))}
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Weight (lb)</span>
              <input
                type="number"
                value={wt}
                onChange={(e) => setWt(Number(e.target.value))}
                style={inputStyle}
              />
            </label>

            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Enrollment Year</span>
              <input
                type="number"
                value={enroll}
                onChange={(e) => setEnroll(Number(e.target.value))}
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={redshirt} onChange={(e) => setRedshirt(e.target.checked)} />
              <span style={{ fontSize: 13, opacity: 0.8 }}>Redshirt</span>
            </label>
          </div>

          {/* Dev & Source (server requires these) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Source</span>
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value as any)} style={inputStyle}>
                <option>Existing Roster</option>
                <option>Recruiting</option>
                <option>Transfer Portal</option>
              </select>
            </label>

            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Dev Trait</span>
              <select value={devTrait} onChange={(e) => setDevTrait(e.target.value as any)} style={inputStyle}>
                <option>Normal</option>
                <option>Impact</option>
                <option>Star</option>
                <option>Elite</option>
              </select>
            </label>

            <label style={labelColStyle}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Dev Cap (0–99)</span>
              <input
                type="number"
                min={0}
                max={99}
                value={devCap}
                onChange={(e) => setDevCap(e.target.value === '' ? '' : clamp99(Number(e.target.value)))}
                style={inputStyle}
              />
            </label>
          </div>

          {/* Archetype subset ratings */}
          {ratingKeys.length > 0 && (
            <>
              <div style={{ marginTop: 20, marginBottom: 8, fontWeight: 600, fontSize: 13, opacity: 0.9 }}>
                Ratings ({activeArch?.name})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                {ratingKeys.map((k) => (
                  <label key={k} style={labelColStyle}>
                    <span style={{ fontSize: 12, opacity: 0.8 }}>{k}</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={subset[k] ?? ''}
                      onChange={(e) => setSub(k, e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ ...headerFooterStyle, bottom: 0, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', color: '#e5e7eb' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: '#4f46e5',
                color: 'white',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Add Player'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}