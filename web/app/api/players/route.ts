// app/api/depth/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';

const prisma: PrismaClient =
  (globalThis as any).__PRISMA__ ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  (globalThis as any).__PRISMA__ = prisma;
}

type ViewMode = 'starters' | 'backups' | 'weighted';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const formationId = searchParams.get('formationId') ?? undefined;
    const season = Number(searchParams.get('season'));
    const view = (searchParams.get('view') ?? 'starters') as ViewMode;

    if (!formationId || !Number.isFinite(season)) {
      return NextResponse.json(
        { error: 'formationId and season are required' },
        { status: 400 }
      );
    }

    // --- Formation meta (best effort)
    let formation: any = null;
    try {
      formation = await prisma.formation.findUnique({ where: { id: formationId } });
    } catch {}
    const formationMeta = {
      side: String(formation?.side ?? 'OFF'),
      name: String(formation?.name ?? 'Formation'),
      variant: formation?.variant ?? null,
    };

    // --- Slots (stable order; avoid assuming an "index" column)
    const slotRows: any[] = await prisma.formationSlot.findMany({
      where: { formationId },
      orderBy: { id: 'asc' },
    });
    if (!slotRows.length) {
      return NextResponse.json(
        { error: 'No slots for this formation' },
        { status: 404 }
      );
    }

    // ---------- helpers ----------
    const onlyLetters = (s: string) => (s || '').toUpperCase().replace(/[^A-Z]/g, '');
    const toNum = (v: any, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    // Slot token normalization → grouping keys used for matching
    const normSlotGroup = (raw: string): string => {
      const t = onlyLetters(raw);
      // Offense
      if (t.startsWith('WR')) return 'WR';
      if (t === 'RB' || t === 'HB' || t === 'TB') return 'RB';
      if (t === 'FB') return 'FB';
      if (t === 'QB') return 'QB';
      if (t === 'TE') return 'TE';
      if (['LT', 'LG', 'C', 'RG', 'RT'].includes(t)) return t;
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
      if (t === 'FS' || t === 'SS' || t === 'S') return t.length === 1 ? 'FS' : t; // 'S' -> FS
      // ST
      if (t === 'K') return 'K';
      if (t === 'P') return 'P';
      return t || 'UNK';
    };

    const normPlayerPos = (raw: string): string => {
      const t = onlyLetters(raw);
      // Offense
      if (t === 'HB' || t === 'TB') return 'RB';
      if (['LT', 'LG', 'C', 'RG', 'RT'].includes(t)) return t;
      if (['WR', 'QB', 'FB', 'TE', 'RB'].includes(t)) return t;
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
      if (
        ['MLB', 'LOLB', 'ROLB', 'LE', 'RE', 'DT', 'CB', 'FS', 'SS', 'K', 'P'].includes(t)
      )
        return t;
      return t || 'UNK';
    };

    const familyOf = (g: string): string => {
      if (['QB'].includes(g)) return 'QB';
      if (['RB', 'FB'].includes(g)) return 'BACK';
      if (['WR'].includes(g)) return 'WR';
      if (['TE'].includes(g)) return 'TE';
      if (['LT', 'LG', 'C', 'RG', 'RT'].includes(g)) return 'OL';
      if (['LE', 'RE', 'EDGE'].includes(g)) return 'EDGE';
      if (['DT'].includes(g)) return 'IDL';
      if (['MLB', 'LOLB', 'ROLB'].includes(g)) return 'LB';
      if (['CB'].includes(g)) return 'CB';
      if (['FS', 'SS'].includes(g)) return 'S';
      if (['K'].includes(g)) return 'K';
      if (['P'].includes(g)) return 'P';
      return 'UNK';
    };

    // Robust abbreviation: "F. LAST" (uppercase LAST), tolerant of "J.J." etc
    const abbr = (full: string) => {
      const parts = full.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return '';
      const firstToken = parts[0].replace(/[^A-Za-z]/g, '');
      const f = (firstToken[0] || '').toUpperCase();
      const last = (parts.at(-1) || '').toUpperCase();
      return f && last ? `${f}. ${last}` : full.toUpperCase();
    };

    // ----- Detect which slot column holds the position token -----
    const keys = Object.keys(slotRows[0] || {});
    const skip = new Set([
      'id',
      'formationId',
      'formation_id',
      'createdAt',
      'updatedAt',
      'x',
      'y',
      'u',
      'v',
      'nx',
      'ny',
      'order',
      'index',
    ]);
    const scoreColumn = (col: string) => {
      let good = 0;
      for (const r of slotRows) {
        const raw = String(r[col] ?? '');
        const g = normSlotGroup(raw);
        if (g && g !== 'UNK') good++;
      }
      return good;
    };
    let posCol: string | null = null,
      bestScore = -1;
    for (const k of keys) {
      if (skip.has(k)) continue;
      if (typeof slotRows[0][k] !== 'string') continue;
      const s = scoreColumn(k);
      if (s > bestScore) {
        bestScore = s;
        posCol = k;
      }
    }
    if (!posCol) {
      for (const k of ['position', 'pos', 'label', 'slot', 'role', 'name', 'abbr']) {
        if (k in (slotRows[0] || {})) {
          posCol = k;
          break;
        }
      }
    }

    // Build normalized slot list
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
        x,
        y,
      };
    });

    // Per-group slot indices (for starters/backups)
    const groupToIndices = new Map<string, number[]>();
    slots.forEach((s, i) => {
      if (!groupToIndices.has(s.groupPos)) groupToIndices.set(s.groupPos, []);
      groupToIndices.get(s.groupPos)!.push(i);
    });

    // --- Players + OVR for this season
    const snaps = await prisma.ratingSnapshot.findMany({
      where: { season },
      select: { playerId: true, ovr: true },
    });
    const ovrById = new Map(snaps.map((s) => [s.playerId, Number(s.ovr ?? 0)]));

    const players = await prisma.player.findMany({
      select: { id: true, name: true, position: true, devTrait: true },
    });

    type PRow = {
      id: string;
      name: string;
      ovr: number;
      devTrait: 'Normal' | 'Impact' | 'Star' | 'Elite' | null;
    };

    // Buckets (exact + family) with OVR-sorted lists
    const exactBuckets = new Map<string, PRow[]>();
    const familyBuckets = new Map<string, PRow[]>();

    for (const p of players) {
      const g = normPlayerPos(String(p.position ?? ''));
      const fam = familyOf(g);
      const row: PRow = {
        id: p.id,
        name: abbr(p.name),
        ovr: ovrById.get(p.id) ?? 0,
        devTrait: (p as any).devTrait ?? null,
      };
      if (!exactBuckets.has(g)) exactBuckets.set(g, []);
      exactBuckets.get(g)!.push(row);
      if (!familyBuckets.has(fam)) familyBuckets.set(fam, []);
      familyBuckets.get(fam)!.push(row);
    }
    for (const map of [exactBuckets, familyBuckets]) {
      for (const list of map.values()) list.sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0));
    }

    // Depth weights for 'weighted'
    const weights = (process.env.DEPTH_WEIGHTS || '1.0,0.6,0.35,0.2,0.1')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    // ---------- Build response ----------
    type StarterSlot = {
      slotKey: string;
      pos: string; // raw label for UI
      type: 'starter' | 'backup';
      player:
        | { id: string; name: string; ovr: number; devTrait: PRow['devTrait'] }
        | null;
      x: number;
      y: number;
    };
    type WeightedSlot = {
      slotKey: string;
      pos: string;
      type: 'weighted';
      players: { id: string; name: string; ovr: number; w: number }[];
      x: number;
      y: number;
    };
    const out: (StarterSlot | WeightedSlot)[] = [];

    if (view === 'weighted') {
      // Weighted uses top N with weights per slot (no uniqueness constraint)
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const indices = groupToIndices.get(s.groupPos)!;
        const N = indices.length;
        const exact = exactBuckets.get(s.groupPos) ?? [];
        const fam = familyBuckets.get(s.family) ?? [];
        const depth = exact.length ? exact : fam;
        const playersW = depth.slice(0, Math.max(N, 1)).map((p, j) => ({
          id: p.id,
          name: p.name,
          ovr: p.ovr,
          w: Number(weights[j] ?? 0),
        }));
        out.push({
          slotKey: s.slotKey,
          pos: s.rawPos || s.groupPos,
          type: 'weighted',
          players: playersW,
          x: s.x,
          y: s.y,
        });
      }
      return NextResponse.json({ formation: formationMeta, season, view, slots: out });
    }

    // Starters / Backups — enforce uniqueness across the formation
    const used = new Set<string>(); // playerIds already placed
    const baseOffsetByView = (N: number) => (view === 'starters' ? 0 : N);

    for (const [group, indices] of groupToIndices.entries()) {
      const N = indices.length;
      const exact = exactBuckets.get(group) ?? [];
      const fam = familyBuckets.get(familyOf(group)) ?? [];
      const depth = exact.length ? exact : fam;

      let cursor = baseOffsetByView(N);
      for (let ord = 0; ord < N; ord++) {
        let chosen: PRow | null = null;
        while (cursor < depth.length) {
          const cand = depth[cursor++];
          if (!used.has(cand.id)) {
            chosen = cand;
            break;
          }
        }

        const slotIdx = indices[ord];
        const s = slots[slotIdx];
        if (chosen) used.add(chosen.id);

        out.push({
          slotKey: s.slotKey,
          pos: s.rawPos || s.groupPos,
          type: view === 'starters' ? 'starter' : 'backup',
          player: chosen
            ? { id: chosen.id, name: chosen.name, ovr: chosen.ovr, devTrait: chosen.devTrait }
            : null,
          x: s.x,
          y: s.y,
        });
      }
    }

    // Preserve original slot order
    out.sort((a, b) => {
      const ia = slots.findIndex((s) => s.slotKey === a.slotKey);
      const ib = slots.findIndex((s) => s.slotKey === b.slotKey);
      return ia - ib;
    });

    return NextResponse.json({ formation: formationMeta, season, view, slots: out });
  } catch (e: any) {
    console.error('GET /api/depth failed:', e);
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}