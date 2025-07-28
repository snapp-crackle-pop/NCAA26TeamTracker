import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function classYearFor(season: number, enroll: number, redshirt: boolean) {
  const idx = Math.min(3, Math.max(0, season - enroll - (redshirt ? 1 : 0)));
  return (['Freshman','Sophomore','Junior','Senior'] as const)[idx];
}

function abbr(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last  = parts[parts.length - 1] ?? '';
  return `${first.charAt(0).toUpperCase()}.${last.toUpperCase()}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = Number(searchParams.get('season') ?? '');
  if (!Number.isFinite(season)) {
    return NextResponse.json({ error: 'season required' }, { status: 400 });
  }

  // all players (we'll filter to those on-roster for the season)
  const players = await prisma.player.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, position: true,
      enrollmentYear: true, redshirt: true,
      heightIn: true, weightLb: true
    }
  });

  // roster filter: enrollmentYear <= season < graduation year
  const onRoster = players.filter(p => {
    const years = 4 + (p.redshirt ? 1 : 0);
    return season >= p.enrollmentYear && season < p.enrollmentYear + years;
  });

  // pull OVR snapshot for that season (may be empty)
  const snaps = await prisma.ratingSnapshot.findMany({
    where: { season },
    select: { playerId: true, ovr: true }
  });
  const ovrById = new Map(snaps.map(s => [s.playerId, s.ovr]));

  const rows = onRoster.map(p => ({
    id: p.id,
    position: p.position,
    name: p.name,
    nameAbbr: abbr(p.name),
    classYear: classYearFor(season, p.enrollmentYear, !!p.redshirt),
    heightIn: p.heightIn ?? null,
    weightLb: p.weightLb ?? null,
    ovr: ovrById.get(p.id) ?? null
  }));

  return NextResponse.json(rows);
}