import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sidePositions } from '@/lib/positions';

const prisma = new PrismaClient();

/**
 * GET /api/roster?season=2025&side=OFF
 * Returns rows ordered by positions for side, each with {pos, players:[{id,name,ovr,cls}]}
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = Number(searchParams.get('season'));
  const side = (searchParams.get('side') ?? 'OFF').toUpperCase() as 'OFF'|'DEF';

  if (!Number.isFinite(season)) {
    return NextResponse.json({ error: 'season required' }, { status: 400 });
  }

  const snaps = await prisma.ratingSnapshot.findMany({
    where: { season },
    include: { player: true }
  });

  const posOrder = sidePositions(side);
  const rows = posOrder.map(pos => {
    const players = snaps
      .filter(s => s.player.position.toUpperCase() === pos)
      .sort((a,b) => b.ovr - a.ovr)
      .map(s => ({
        id: s.playerId,
        name: s.player.name,
        ovr: s.ovr,
        cls: classFrom(season, s.player.enrollmentYear, s.player.redshirt)
      }));
    return { pos, players };
  });

  return NextResponse.json({ side, season, rows });
}

function classFrom(season: number, enroll: number, redshirt: boolean) {
  const rs = redshirt ? 1 : 0;
  const y = season - enroll - rs;
  if (y <= 0) return 'Fr';
  if (y === 1) return 'So';
  if (y === 2) return 'Jr';
  return 'Sr';
}