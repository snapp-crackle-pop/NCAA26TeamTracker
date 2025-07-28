import { NextResponse } from 'next/server';
import { ensureSnapshots } from '@/lib/progression';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = Number(searchParams.get('start') ?? NaN);
  const horizon = Number(searchParams.get('horizon') ?? '5');
  if (!Number.isFinite(start) || horizon < 0) {
    return NextResponse.json({ error: 'invalid start/horizon' }, { status: 400 });
  }
  await ensureSnapshots(start, horizon);
  return NextResponse.json({ ok: true });
}