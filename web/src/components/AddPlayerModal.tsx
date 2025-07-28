'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  season: number;
  onClose: () => void;
  onCreated?: () => void;
};

const toInches = (ft: number, inch: number) => ft * 12 + inch;

export default function AddPlayerModal({ open, season, onClose, onCreated }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const [pos, setPos] = useState('WR');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [ft, setFt] = useState(6);
  const [inch, setInch] = useState(0);
  const [wt, setWt] = useState(200);
  const [enroll, setEnroll] = useState(season);
  const [redshirt, setRedshirt] = useState(false);
  const [ovr, setOvr] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: pos,
          firstName: first.trim(),
          lastName: last.trim(),
          heightIn: toInches(Number(ft), Number(inch)),
          weightLb: Number(wt),
          enrollmentYear: Number(enroll),
          redshirt: Boolean(redshirt),
          snapshot: { season, ovr: ovr === '' ? null : Number(ovr) },
        }),
      });
      if (!res.ok) throw new Error(`POST /api/players ${res.status}`);
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Could not add player.');
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  // Inline styles to guarantee centering + backdrop
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
    width: 'min(760px, 96vw)',
    maxHeight: '90vh',
    overflow: 'auto',
    borderRadius: 16,
    background: '#111',
    color: '#f3f4f6',
    boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const sectionStyle: React.CSSProperties = { padding: '16px 20px' };
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

  return createPortal(
    <div style={overlayStyle} onClick={onClose} aria-modal="true" role="dialog">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={cardStyle}
      >
        {/* Header */}
        <div style={{ ...headerFooterStyle, top: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Add Player · {season}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ padding: '4px 8px', borderRadius: 6 }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Position</span>
              <select value={pos} onChange={(e) => setPos(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }}>
                {['QB','RB','FB','WR','TE','LT','LG','C','RG','RT','LE','RE','DT','LOLB','MLB','ROLB','CB','FS','SS','K','P']
                  .map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Enrollment Year</span>
              <input type="number" value={enroll} onChange={e => setEnroll(Number(e.target.value))}
                     style={{ padding: '8px 10px', borderRadius: 8, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>First Name</span>
              <input value={first} onChange={e => setFirst(e.target.value)}
                     style={{ padding: '8px 10px', borderRadius: 8, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Last Name</span>
              <input value={last} onChange={e => setLast(e.target.value)}
                     style={{ padding: '8px 10px', borderRadius: 8, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Height (ft)</span>
                <input type="number" value={ft} onChange={e => setFt(Number(e.target.value))}
                       style={{ padding: '8px 10px', borderRadius: 8, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.8 }}>Height (in)</span>
                <input type="number" value={inch} onChange={e => setInch(Number(e.target.value))}
                       style={{ padding: '8px 10px', borderRadius: 8, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Weight (lb)</span>
              <input type="number" value={wt} onChange={e => setWt(Number(e.target.value))}
                     style={{ padding: '8px 10px', borderRadius: 8, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={redshirt} onChange={e => setRedshirt(e.target.checked)} />
              <span style={{ fontSize: 13, opacity: 0.8 }}>Redshirt</span>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>OVR (snapshot for {season})</span>
              <input type="number" placeholder="leave blank if unknown" value={ovr}
                     onChange={(e) => setOvr(e.target.value === '' ? '' : Number(e.target.value))}
                     style={{ padding: '8px 10px', borderRadius: 8, background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{ ...headerFooterStyle, bottom: 0, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}
                    style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', color: '#e5e7eb' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
                    style={{ padding: '8px 12px', borderRadius: 8, background: '#4f46e5', color: 'white', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Add Player'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}