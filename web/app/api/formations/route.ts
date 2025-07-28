export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const rows = await prisma.formation.findMany({
    select: { id: true, side: true, name: true, variant: true },
    orderBy: [{ side: 'asc' }, { name: 'asc' }, { variant: 'asc' }],
  });
  return NextResponse.json(rows);
}