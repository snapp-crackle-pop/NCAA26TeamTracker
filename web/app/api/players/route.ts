import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { sanitizeStr } from '@/lib/enums';
import { predictFromSubset } from '@/lib/predict';

const prisma = new PrismaClient();

const PlayerCreate = z.object({
  name: z.string().min(1),
  position: z.string(),
  archetypeId: z.string().min(1),
  heightIn: z.number().int().min(55).max(90).optional(),
  weightLb: z.number().int().min(120).max(400).optional(),
  handedness: z.string().optional(),
  sourceType: z.enum(['Recruiting','Transfer Portal','Existing Roster']),
  devTrait: z.enum(['Normal','Impact','Star','Elite']),
  devCap: z.number().int().min(0).max(99).optional(),
  enrollmentYear: z.number().int(),
  redshirt: z.boolean().optional(),
  transferFrom: z.string().optional(),
  notes: z.string().optional(),
  season: z.number().int(), // <-- season for initial snapshot (registryYear)
  subset: z.record(z.string(), z.number().int().min(0).max(99)).default({})
}).strip();

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const seasonStr = searchParams.get('season');
    const season = seasonStr ? Number(seasonStr) : NaN;
    if (!seasonStr || Number.isNaN(season)) {
      return NextResponse.json({ error: 'season required' }, { status: 400 });
    }
  
    // Get OVR snapshot for the requested season (if present)
    const snapshots = await prisma.ratingSnapshot.findMany({
      where: { season },
      select: { playerId: true, ovr: true },
    });
    const byPlayer = new Map(snapshots.map((s) => [s.playerId, s.ovr]));
  
    const players = await prisma.player.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, position: true, classYear: true },
    });
  
    const rows = players.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      classYear: p.classYear,
      ovr: byPlayer.get(p.id) ?? null,
    }));
  
    return NextResponse.json(rows);
  }

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = PlayerCreate.parse(json);

  const player = await prisma.player.create({
    data: {
      name: sanitizeStr(parsed.name),
      position: parsed.position.trim(),
      archetypeId: parsed.archetypeId,
      heightIn: parsed.heightIn,
      weightLb: parsed.weightLb,
      handedness: parsed.handedness?.trim(),
      sourceType: parsed.sourceType,
      devTrait: parsed.devTrait,
      devCap: parsed.devCap,
      enrollmentYear: parsed.enrollmentYear,
      redshirt: !!parsed.redshirt,
      transferFrom: sanitizeStr(parsed.transferFrom),
      notes: sanitizeStr(parsed.notes)
    }
  });

  // Initial predicted snapshot
  const { ratings, ovr } = await predictFromSubset({
    position: player.position,
    archetypeId: player.archetypeId!,
    subset: parsed.subset,
    devTrait: player.devTrait as any,
    devCap: player.devCap ?? null
  });

  await prisma.ratingSnapshot.create({
    data: {
      playerId: player.id,
      season: parsed.season,
      ratings: JSON.stringify(ratings),
      ovr,
      predicted: true
    }
  });

  return NextResponse.json(player, { status: 201 });
}