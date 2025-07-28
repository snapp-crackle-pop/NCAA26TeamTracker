// app/api/depth/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

const prisma: PrismaClient = (globalThis as any).__PRISMA__ ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') (globalThis as any).__PRISMA__ = prisma;

type ViewMode = 'starters' | 'backups' | 'weighted';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const formationId = searchParams.get('formationId') ?? undefined;
    const season = Number(searchParams.get('season'));
    const view = (searchParams.get('view') ?? 'starters') as ViewMode;

    // NEW: be permissive; return empty result when formationId is not set yet
if (!formationId) {
    const seasonNum = Number.isFinite(season) ? season : null;
    return NextResponse.json({ formation: null, season: seasonNum, view, slots: [] });
  }
  if (!Number.isFinite(season)) {
    return NextResponse.json({ error: 'season is required' }, { status: 400 });
  }

    // Formation meta (best effort)
    let formation: any = null;
    try { formation = await prisma.formation.findUnique({ where: { id: formationId } }); } catch {}
    const formationMeta = {
      side: String(formation?.side ?? 'OFF'),
      name: String(formation?.name ?? 'Formation'),
      variant: formation?.variant ?? null,
    };

    // Load slots (order by id for stability)
    const slotRows: any[] = await prisma.formationSlot.findMany({
      where: { formationId },
      orderBy: { id: 'asc' },
    });
    if (!slotRows.length) {
      return NextResponse.json({ error: 'No slots for this formation' }, { status: 404 });
    }

    // ---------- helpers ----------
    const onlyLetters = (s: string) => (s || '').toUpperCase().replace(/[^A-Z]/g, '');
    const isFiniteNum = (v: any) => typeof v === 'number' && Number.isFinite(v);

    const normSlotGroup = (raw: string): string => {
      const t = onlyLetters(raw);
      // Offense
      if (t.startsWith('WR')) return 'WR';
      if (t === 'RB' || t === 'HB' || t === 'TB') return 'RB';
      if (t === 'FB') return 'FB';
      if (t === 'QB') return 'QB';
      if (t === 'TE') return 'TE';
      if (['LT','LG','C','RG','RT'].includes(t)) return t;
      // Defense
      if (t === 'EDGE') return 'EDGE';
      if (t === 'LEDG' || t === 'LE') return 'LE';
      if (t === 'REDG' || t === 'RE') return 'RE';
      if (t === 'DT' || t === 'NT' || t === 'IDL') return 'DT';
      if (t === 'SAM' || t === 'LOLB' || t === 'OLB') return 'LOLB';
      if (t === 'WILL' || t === 'ROLB') return 'ROLB';
      if (t === 'MIKE' || t === 'MLB' || t === 'ILB' || t === 'LB') return 'MLB';
      if (t === 'NB' || t === 'NICKEL' || t === 'STAR') return 'CB';
      if (t === 'CB') return 'CB';
      if (t === 'FS' || t === 'SS' || t === 'S') return t.length === 1 ? 'FS' : t;
      // ST
      if (t === 'K') return 'K';
      if (t === 'P') return 'P';
      return t || 'UNK';
    };

    const normPlayerPos = (raw: string): string => {
      const t = onlyLetters(raw);
      // Offense
      if (t === 'HB' || t === 'TB') return 'RB';
      if (['LT','LG','C','RG','RT'].includes(t)) return t;
      if (['WR','QB','FB','TE','RB'].includes(t)) return t;
      // Defense
      if (t === 'EDGE') return 'EDGE';
      if (t === 'LEDG') return 'LE';
      if (t === 'REDG') return 'RE';
      if (t === 'OLB') return 'LOLB';
      if (t === 'SAM') return 'LOLB';
      if (t === 'WILL') return 'ROLB';
      if (t === 'MIKE' || t === 'ILB' || t === 'LB') return 'MLB';
      if (t === 'NB' || t === 'NICKEL' || t === 'STAR') return 'CB';
      if (t === 'S') return 'FS';
      if (['MLB','LOLB','ROLB','LE','RE','DT','CB','FS','SS','K','P'].includes(t)) return t;
      return t || 'UNK';
    };

    const familyOf = (g: string): string => {
      if (['QB'].includes(g)) return 'QB';
      if (['RB','FB'].includes(g)) return 'BACK';
      if (['WR'].includes(g)) return 'WR';
      if (['TE'].includes(g)) return 'TE';
      if (['LT','LG','C','RG','RT'].includes(g)) return 'OL';
      if (['LE','RE','EDGE'].includes(g)) return 'EDGE';
      if (['DT'].includes(g)) return 'IDL';
      if (['MLB','LOLB','ROLB'].includes(g)) return 'LB';
      if (['CB'].includes(g)) return 'CB';
      if (['FS','SS'].includes(g)) return 'S';
      if (['K'].includes(g)) return 'K';
      if (['P'].includes(g)) return 'P';
      return 'UNK';
    };

    // ----- auto-detect which column carries the slot's position label -----
    const keys = Object.keys(slotRows[0] || {});
    const skip = new Set(['id','formationId','formation_id','createdAt','updatedAt','x','y','u','v','nx','ny','order','index']);
    const scoreColumn = (col: string) => {
      let good = 0;
      for (const r of slotRows) {
        const raw = String(r[col] ?? '');
        const g = normSlotGroup(raw);
        if (g && g !== 'UNK') good++;
      }
      return good;
    };
    let posCol: string | null = null, bestScore = -1;
    for (const k of keys) {
      if (skip.has(k)) continue;
      if (typeof slotRows[0][k] !== 'string') continue;
      const s = scoreColumn(k);
      if (s > bestScore) { bestScore = s; posCol = k; }
    }
    // Fallback: try common names if nothing scored
    if (!posCol) {
      for (const k of ['position','pos','label','slot','role','name','abbr']) {
        if (k in (slotRows[0] || {})) { posCol = k; break; }
      }
    }

    const slots = slotRows.map((r) => {
      const rawPos = posCol ? String(r[posCol] ?? '') : '';
      const groupPos = normSlotGroup(rawPos);
      const x = toNum((r as any).x ?? (r as any).u ?? (r as any).nx, 0.5);
      const y = toNum((r as any).y ?? (r as any).v ?? (r as any).ny, 0.5);
      return {
        slotKey: String(r.id),
        rawPos,
        groupPos,
        family: familyOf(groupPos),
        x, y,
      };
    });

    // Per-group slot indices
    const groupToIndices = new Map<string, number[]>();
    slots.forEach((s, i) => {
      if (!groupToIndices.has(s.groupPos)) groupToIndices.set(s.groupPos, []);
      groupToIndices.get(s.groupPos)!.push(i);
    });

    // Players + OVR
    const snaps = await prisma.ratingSnapshot.findMany({
      where: { season },
      select: { playerId: true, ovr: true },
    });
    const ovrById = new Map(snaps.map((s) => [s.playerId, Number(s.ovr ?? 0)]));

    const players = await prisma.player.findMany({
      select: { id: true, name: true, position: true },
    });

    // Abbrev: F.LAST (LAST in uppercase), e.g. "J.SNAPP"
    const abbr = (full: string) => {
      const parts = full.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return '';
      const f = (parts[0]?.[0] ?? '').toUpperCase();
      const last = (parts.at(-1) ?? '').toUpperCase();
      return f && last ? `${f}.${last}` : full.toUpperCase();
    };

    // Buckets (exact + family)
    const exactBuckets = new Map<string, { id: string; name: string; ovr: number }[]>();
    const familyBuckets = new Map<string, { id: string; name: string; ovr: number }[]>();
    for (const p of players) {
      const g = normPlayerPos(String(p.position ?? ''));
      const fam = familyOf(g);
      const row = { id: p.id, name: abbr(p.name), ovr: ovrById.get(p.id) ?? 0 };
      if (!exactBuckets.has(g)) exactBuckets.set(g, []);
      exactBuckets.get(g)!.push(row);
      if (!familyBuckets.has(fam)) familyBuckets.set(fam, []);
      familyBuckets.get(fam)!.push(row);
    }
    for (const map of [exactBuckets, familyBuckets]) {
      for (const list of map.values()) list.sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0));
    }

    // Depth weights for weighted view
    const weights = (process.env.DEPTH_WEIGHTS || '1.0,0.6,0.35,0.2,0.1')
      .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);

    // ---------- Build response ----------
    type StarterSlot = {
      slotKey: string;
      pos: string;
      type: 'starter' | 'backup';
      player: { id: string; name: string; ovr: number } | null;
      x: number; y: number;
    };
    type WeightedSlot = {
      slotKey: string;
      pos: string;
      type: 'weighted';
      players: { id: string; name: string; ovr: number; w: number }[];
      x: number; y: number;
    };
    const out: (StarterSlot | WeightedSlot)[] = [];

    if (view === 'weighted') {
      // Per-slot weighted arrays (no uniqueness constraint)
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const indices = groupToIndices.get(s.groupPos)!;
        const N = indices.length;
        const exact = exactBuckets.get(s.groupPos) ?? [];
        const fam = familyBuckets.get(s.family) ?? [];
        const depth = exact.length ? exact : fam;
        const playersW = depth.slice(0, Math.max(N, 1)).map((p, j) => ({
          id: p.id, name: p.name, ovr: p.ovr, w: Number(weights[j] ?? 0),
        }));
        out.push({ slotKey: s.slotKey, pos: s.rawPos || s.groupPos, type: 'weighted', players: playersW, x: s.x, y: s.y });
      }
      return NextResponse.json({ formation: formationMeta, season, view, slots: out });
    }

    // Starters / Backups — enforce uniqueness across the whole formation
    const used = new Set<string>(); // playerIds already placed
    const baseOffsetByView = (N: number) => (view === 'starters' ? 0 : N);

    // Allocate per group so we respect slot order within each group
    for (const [group, indices] of groupToIndices.entries()) {
      const N = indices.length;
      const exact = exactBuckets.get(group) ?? [];
      const fam = familyBuckets.get(familyOf(group)) ?? [];
      const depth = exact.length ? exact : fam;

      let cursor = baseOffsetByView(N);
      for (let ord = 0; ord < N; ord++) {
        // find next not-yet-used candidate
        let chosen: { id: string; name: string; ovr: number } | null = null;
        while (cursor < depth.length) {
          const cand = depth[cursor++];
          if (!used.has(cand.id)) { chosen = cand; break; }
        }

        const slotIdx = indices[ord];
        const s = slots[slotIdx];
        if (chosen) used.add(chosen.id);

        out.push({
          slotKey: s.slotKey,
          pos: s.rawPos || s.groupPos,
          type: view === 'starters' ? 'starter' : 'backup',
          player: chosen ? { id: chosen.id, name: chosen.name, ovr: chosen.ovr } : null,
          x: s.x, y: s.y,
        });
      }
    }

    // Preserve overall slot order (we built per-group)
    out.sort((a, b) => {
      const ia = slots.findIndex(s => s.slotKey === a.slotKey);
      const ib = slots.findIndex(s => s.slotKey === b.slotKey);
      return ia - ib;
    });

    return NextResponse.json({ formation: formationMeta, season, view, slots: out });
  } catch (e: any) {
    console.error('GET /api/depth failed:', e);
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

function toNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}