import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

function csvToRows(p: string): string[][] {
  const raw = fs.readFileSync(p, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line =>
      line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    );
}

(async () => {
  try {
    const csvPath = path.join(process.cwd(), 'prisma', 'seed', 'archetypes.csv');
    const rows = csvToRows(csvPath);

    // Expect columns: position, archetypeName, subsetKey1, subsetKey2, ...
    for (const [position, name, ...subset] of rows) {
        if (!position || !name) continue;
        const subsetKeys = subset.filter(Boolean);
      
        const data = {
          position,
          name,
          subsetKeys: JSON.stringify(subsetKeys),
          baseTemplate: JSON.stringify({}),
          mappingConfig: JSON.stringify({}),
        };
      
        const existing = await prisma.archetype.findFirst({
          where: { position, name },
          select: { id: true },
        });
      
        if (existing) {
          await prisma.archetype.update({
            where: { id: existing.id },
            data: {
              position,
              subsetKeys: JSON.stringify(subsetKeys),
              // keep baseTemplate/mappingConfig if you want, or update as needed
            },
          });
        } else {
          await prisma.archetype.create({ data });
        }
      }

    console.log(`Seeded archetypes: ${rows.length}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();