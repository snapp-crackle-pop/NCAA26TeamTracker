// app/api/players/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { predictFromSubset } from '../../../src/lib/predict';

export const runtime = 'nodejs';

// Reuse Prisma during dev HMR
const prisma: PrismaClient =
  (globalThis as any).__PRISMA__ ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') (globalThis as any).__PRISMA__ = prisma;

// ---------- GET /api/players?season=YYYY ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = Number(searchParams.get('season'));
  if (!Number.isFinite(season)) {
    return NextResponse.json({ error: 'season required' }, { status: 400 });
  }

  const players = await prisma.player.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      position: true,
      heightIn: true,
      weightLb: true,
      enrollmentYear: true,
      redshirt: true,
    },
  });

  const snaps = await prisma.ratingSnapshot.findMany({
    where: { season },
    select: { playerId: true, ovr: true },
  });
  const ovrById = new Map(snaps.map((s) => [s.playerId, s.ovr]));

  const rows = players.map((p) => ({
    id: p.id,
    position: p.position,
    name: p.name,
    heightIn: p.heightIn,
    weightLb: p.weightLb,
    ovr: ovrById.get(p.id) ?? null,
  }));

  return NextResponse.json(rows);
}

// ---------- POST /api/players ----------
type Body = {
  name: string;
  position: string; // UI may send 'RB' — we map to 'HB' for predictor
  archetypeId: string;
  heightIn?: number | null;
  weightLb?: number | null;
  sourceType: 'Recruiting' | 'Transfer Portal' | 'Existing Roster';
  devTrait: 'Normal' | 'Impact' | 'Star' | 'Elite';
  devCap?: number | null;
  enrollmentYear: number;
  redshirt?: boolean;
  season: number;
  subset?: Record<string, number>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body.name || !body.position || !body.archetypeId || !Number.isFinite(body.season)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1) Create player
    const player = await prisma.player.create({
      data: {
        name: body.name.trim(),
        position: body.position,
        archetypeId: body.archetypeId,
        heightIn: body.heightIn ?? null,
        weightLb: body.weightLb ?? null,
        sourceType: body.sourceType,
        devTrait: body.devTrait,
        devCap: body.devCap ?? null,
        enrollmentYear: body.enrollmentYear,
        redshirt: !!body.redshirt,
      },
      select: { id: true },
    });

    // 2) Compute OVR server-side (ignore any client OVR)
    const subset = body.subset ?? {};
    const predictorPosition =
      body.position?.toUpperCase() === 'RB' ? 'HB' : body.position;

    let ovr: number;
    try {
      const { ovr: predicted } = await predictFromSubset({
        position: predictorPosition,
        archetypeId: body.archetypeId,
        subset,
        devTrait: body.devTrait,
        devCap: body.devCap ?? undefined,
      });
      ovr = Math.round(predicted);
    } catch (e) {
      // Safe fallback: mean of provided subset values
      const vals = Object.values(subset).map(Number).filter(Number.isFinite);
      ovr = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 60;
      console.warn('predictFromSubset failed; using fallback mean. Error:', e);
    }

    // 3) Initial snapshot — your model expects `ratings` (String)
    await prisma.ratingSnapshot.create({
      data: {
        playerId: player.id,
        season: body.season,
        ovr,
        ratings: JSON.stringify(subset), // required String column
        predicted: true,
      },
    });

    return NextResponse.json({ ok: true, id: player.id });
  } catch (err) {
    console.error('POST /api/players failed', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}