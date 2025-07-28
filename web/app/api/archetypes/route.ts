import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/archetypes?position=WR
 * Returns: [{ id, position, name, subsetKeys: string[] }]
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const position = searchParams.get('position')?.trim();

  const rows = await prisma.archetype.findMany({
    where: position ? { position } : undefined,
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { id: true, position: true, name: true, subsetKeys: true },
  });

  const data = rows.map(r => ({
    id: r.id,
    position: r.position.trim(),
    name: r.name.trim(),
    subsetKeys: JSON.parse(r.subsetKeys || '[]') as string[],
  }));

  return NextResponse.json(data);
}