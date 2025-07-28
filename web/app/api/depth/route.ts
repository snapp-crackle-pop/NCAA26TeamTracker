export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type ViewMode = 'starters' | 'backups' | 'weighted';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const formationIdParam = searchParams.get('formationId');
  const season = Number(searchParams.get('season') ?? '2025');
  const view = (searchParams.get('view') ?? 'starters') as ViewMode;

  if (!formationIdParam || formationIdParam === 'undefined') {
    // If no id provided, try to return the first available (helps first render)
    const first = await prisma.formation.findFirst({ include: { slots: true } });
    if (!first) {
      return NextResponse.json({ error: 'No formations in DB — seed first.' }, { status: 404 });
    }
    return NextResponse.json(makeDepthResponse(first, season, view));
  }

  const byString = await prisma.formation.findUnique({
    where: { id: formationIdParam as any }, // works if id is String
    include: { slots: true },
  }).catch(() => null);

  let formation = byString;

  if (!formation) {
    const num = Number(formationIdParam);
    if (Number.isInteger(num)) {
      formation = await prisma.formation.findUnique({
        where: { id: num as any }, // works if id is Int
        include: { slots: true },
      }).catch(() => null);
    }
  }

  if (!formation) {
    return NextResponse.json(
      { error: `Formation not found for id "${formationIdParam}"` },
      { status: 404 },
    );
  }

  return NextResponse.json(makeDepthResponse(formation, season, view));
}

/* ---------- helpers ---------- */

function to01(v: number | null): number | null {
  if (v === null || Number.isNaN(v)) return null;
  if (v < 0) return 0;
  if (v > 1 && v <= 100) return v / 100; // allow 0..100 data
  if (v > 1) return 1;
  return v;
}

function firstHint(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return String(arr[0]);
  } catch {}
  return null;
}

function makeDepthResponse(
  formation: {
    side: string;
    name: string;
    variant: string | null;
    slots: { slotKey: string; positionHints: string | null; x: number | null; y: number | null }[];
  },
  season: number,
  view: ViewMode,
) {
  const baseSlots = (formation.slots ?? []).map((s) => ({
    slotKey: s.slotKey,
    pos: firstHint(s.positionHints) ?? s.slotKey,
    x: to01(s.x),
    y: to01(s.y),
  }));

  const slots =
    view === 'weighted'
      ? baseSlots.map((s) => ({
          slotKey: s.slotKey,
          pos: s.pos,
          type: 'weighted' as const,
          ovr: 0,
          contributors: [],
          x: s.x,
          y: s.y,
        }))
      : baseSlots.map((s) => ({
          slotKey: s.slotKey,
          pos: s.pos,
          type: view, // 'starters' | 'backups'
          player: null, // plug your real player selection later
          x: s.x,
          y: s.y,
        }));

  return {
    formation: { side: formation.side, name: formation.name, variant: formation.variant },
    season,
    view,
    slots,
  };
}