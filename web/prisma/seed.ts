// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

function csvToRows(p: string): string[][] {
  const raw = fs.readFileSync(p, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
}

async function seedArchetypes() {
  const csvPath = path.join(process.cwd(), 'prisma', 'seed', 'archetypes.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('No archetypes.csv found at prisma/seed/archetypes.csv — skipping archetypes seed.');
    return;
  }

  const rows = csvToRows(csvPath);

  for (const [position, name, ...subset] of rows) {
    if (!position || !name) continue;
    const subsetKeys = subset.filter(Boolean);

    const data = {
      position: position.trim(),
      name: name.trim(),
      subsetKeys: JSON.stringify(subsetKeys.map(s => s.trim())),
      baseTemplate: JSON.stringify({}),     // fill later if desired
      mappingConfig: JSON.stringify({}),    // fill later if desired
    };

    const existing = await prisma.archetype.findFirst({
      where: { position: data.position, name: data.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.archetype.update({
        where: { id: existing.id },
        data: {
          position: data.position,
          subsetKeys: data.subsetKeys,
          // keep templates/mapping unless you want to overwrite here
        },
      });
    } else {
      await prisma.archetype.create({ data });
    }
  }

  console.log(`Seeded/updated archetypes: ${rows.length}`);
}

async function seedFormations() {
  const formations = [
    {
      side: 'OFF', name: 'SHOTGUN', variant: '5WR', slots: [
        // x,y normalized [0..1]
        ['LT','LT',0.15,0.50], ['LG','LG',0.20,0.50], ['C','C',0.25,0.50], ['RG','RG',0.30,0.50], ['RT','RT',0.35,0.50],
        ['QB','QB',0.25,0.65],
        ['WR1','WR',0.05,0.35], ['WR2','WR',0.15,0.25], ['WR3','WR',0.35,0.25], ['WR4','WR',0.20,0.20], ['WR5','WR',0.30,0.20],
      ]
    },
    {
      side: 'DEF', name: '3-3-5', variant: null, slots: [
        ['LEDG','LEDG',0.15,0.45], ['DT','DT',0.25,0.45], ['REDG','REDG',0.35,0.45],
        ['SAM','SAM',0.15,0.58], ['MIKE','MIKE',0.25,0.58], ['WILL','WILL',0.35,0.58],
        ['CB1','CB',0.05,0.35], ['CB2','CB',0.45,0.35],
        ['FS','FS',0.25,0.25], ['SS','SS',0.35,0.30], ['NB','CB',0.15,0.30]
      ]
    }
  ];

  for (const f of formations) {
    // find-or-create formation by (side, name, variant)
    const existing = await prisma.formation.findFirst({
      where: { side: f.side, name: f.name, variant: f.variant ?? undefined },
      select: { id: true },
    });

    const formationId = existing
      ? existing.id
      : (await prisma.formation.create({ data: { side: f.side, name: f.name, variant: f.variant ?? undefined } })).id;

    // reset slots for idempotency
    await prisma.formationSlot.deleteMany({ where: { formationId } });

    for (const s of f.slots) {
      const [slotKey, posHint, x, y] = s as [string,string,number,number];
      await prisma.formationSlot.create({
        data: {
          formationId,
          slotKey,
          positionHints: JSON.stringify([posHint]),
          x, y
        }
      });
    }
  }

  console.log('Seeded/updated formations:', formations.length);
}

async function main() {
  await seedArchetypes();
  await seedFormations();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });