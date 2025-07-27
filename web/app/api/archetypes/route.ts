import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const rows = await prisma.archetype.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { id: true, position: true, name: true, subsetKeys: true },
  });
  // parse subsetKeys JSON to string[]
  const data = rows.map(r => ({
    id: r.id,
    position: r.position.trim(),
    name: r.name.trim(),
    subsetKeys: JSON.parse(r.subsetKeys || '[]') as string[],
  }));
  return NextResponse.json(data);
}