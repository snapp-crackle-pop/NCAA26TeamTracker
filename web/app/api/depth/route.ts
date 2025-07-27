import { NextResponse } from 'next/server';
import { resolveDepth } from '@/lib/depth';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const formationId = searchParams.get('formationId');
  const seasonStr = searchParams.get('season');
  const view = (searchParams.get('view') ?? 'starters') as 'starters'|'backups'|'weighted';

  if (!formationId || !seasonStr) return NextResponse.json({ error: 'formationId and season required' }, { status: 400 });
  const season = Number(seasonStr);

  const data = await resolveDepth(formationId, season, view);
  return NextResponse.json(data);
}