import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const Id = z.string().cuid();

export async function PATCH(_: Request, { params }: { params: { id: string }}) {
  const id = Id.parse(params.id);
  const body = await _.json();
  const updated = await prisma.player.update({ where: { id }, data: body });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string }}) {
  const id = Id.parse(params.id);
  await prisma.player.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}