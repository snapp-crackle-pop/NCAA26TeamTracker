import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const PlayerCreate = z.object({
  name: z.string().trim().min(1),
  position: z.string(),
  archetypeId: z.string().optional(),
  heightIn: z.number().int().min(55).max(90).optional(),
  weightLb: z.number().int().min(120).max(400).optional(),
  handedness: z.string().optional(),
  sourceType: z.enum(['Recruiting','Transfer Portal','Existing Roster']),
  devTrait: z.enum(['Normal','Impact','Star','Elite']),
  devCap: z.number().int().min(0).max(99).optional(),
  enrollmentYear: z.number().int(),
  redshirt: z.boolean().optional(),
  transferFrom: z.string().optional(),
  notes: z.string().optional()
});

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(players);
}

export async function POST(req: Request) {
  const json = await req.json();
  const data = PlayerCreate.parse(json);
  const created = await prisma.player.create({ data });
  return NextResponse.json(created, { status: 201 });
}