import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const rows = await prisma.formation.findMany({
    orderBy: [{ side: 'asc' }, { name: 'asc' }, { variant: 'asc' }],
    select: { id: true, side: true, name: true, variant: true }
  });
  return NextResponse.json(rows);
}