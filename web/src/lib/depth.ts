import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WEIGHTS: Record<string, number[]> = {
  QB: [0.7,0.3], HB: [0.6,0.25,0.15], WR: [0.5,0.25,0.15,0.1], TE: [0.7,0.3],
  LT:[0.6,0.25,0.15], LG:[0.6,0.25,0.15], C:[0.6,0.25,0.15], RG:[0.6,0.25,0.15], RT:[0.6,0.25,0.15],
  LEDG:[0.6,0.25,0.15], REDG:[0.6,0.25,0.15], DT:[0.6,0.25,0.15],
  SAM:[0.6,0.25,0.15], MIKE:[0.6,0.25,0.15], WILL:[0.6,0.25,0.15],
  CB:[0.5,0.25,0.15,0.1], FS:[0.6,0.25,0.15], SS:[0.6,0.25,0.15]
};

export async function resolveDepth(formationId: string, season: number, view: 'starters'|'backups'|'weighted') {
  const formation = await prisma.formation.findUnique({
    where: { id: formationId },
    include: { slots: true }
  });
  if (!formation) throw new Error('Formation not found');

  // get all snapshots for the season
  const snaps = await prisma.ratingSnapshot.findMany({
    where: { season },
    include: { player: true }
  });

  // group by position
  const byPos = new Map<string, { id:string; name:string; ovr:number }[]>();
  for (const s of snaps) {
    const pos = s.player.position;
    if (!byPos.has(pos)) byPos.set(pos, []);
    byPos.get(pos)!.push({ id: s.playerId, name: s.player.name, ovr: s.ovr });
  }
  for (const list of byPos.values()) list.sort((a,b)=>b.ovr - a.ovr);

  const used = new Set<string>();
  const result = formation.slots.map(slot => {
    const hints: string[] = JSON.parse(slot.positionHints || '[]');
    // pick a primary hint or fall back to slotKey (e.g., WR1 → WR)
    const posKey = hints[0] ?? slot.slotKey.replace(/\d+$/, '');
    const pool = byPos.get(posKey) ?? [];

    if (view === 'starters') {
      const pick = pool.find(p => !used.has(p.id));
      if (pick) used.add(pick.id);
      return { slotKey: slot.slotKey, pos: posKey, type: 'starter', player: pick ?? null, x: slot.x, y: slot.y };
    }

    if (view === 'backups') {
      const pick = pool.filter(p => !used.has(p.id))[1]; // second best
      if (pick) used.add(pick.id);
      return { slotKey: slot.slotKey, pos: posKey, type: 'backup', player: pick ?? null, x: slot.x, y: slot.y };
    }

    // weighted
    const weights = WEIGHTS[posKey] ?? [1.0];
    const contributors = pool.slice(0, weights.length).map((p, i) => ({ ...p, w: weights[i] }));
    const composite = contributors.reduce((s,c)=>s + c.w * c.ovr, 0);
    return { slotKey: slot.slotKey, pos: posKey, type: 'weighted', ovr: Math.round(composite), contributors, x: slot.x, y: slot.y };
  });

  return { formation: { side: formation.side, name: formation.name, variant: formation.variant }, season, view, slots: result };
}