import { PrismaClient } from '@prisma/client';
import { RATING_KEYS, RatingKey, emptyRatings, clamp99 } from './ratings';

const prisma = new PrismaClient();

/**
 * Predict full ratings + OVR given position, archetype, subset ratings and dev info.
 * MVP rules:
 *  - Start from archetype.baseTemplate (if provided) else zeros.
 *  - For each missing rating R: R = a0 + Σ wi * subset[i] where wi come from mappingConfig.
 *  - If mappingConfig is absent, copy the closest relevant subset key or fall back to simple averages.
 *  - OVR: simple position-weighted average (coarse default you can tune later).
 */
export async function predictFromSubset(params: {
  position: string;
  archetypeId: string;
  subset: Record<string, number>;
  devTrait?: 'Normal'|'Impact'|'Star'|'Elite';
  devCap?: number | null;
}) {
  const { position, archetypeId, subset, devTrait, devCap } = params;

  const arch = await prisma.archetype.findUnique({
    where: { id: archetypeId },
    select: { baseTemplate: true, mappingConfig: true, subsetKeys: true, name: true, position: true }
  });
  if (!arch) throw new Error('Archetype not found');

  const baseTemplate = safeParseJSON<Record<RatingKey, number>>(arch.baseTemplate) ?? emptyRatings();
  const mapCfg = safeParseJSON<any>(arch.mappingConfig) ?? {};
  const ratings = { ...emptyRatings(), ...baseTemplate };

  // normalize subset keys (trim)
  const subsetClean: Record<string, number> = {};
  for (const [k, v] of Object.entries(subset || {})) {
    subsetClean[k.trim().toUpperCase()] = clamp99(v);
  }

  // Fill missing ratings using mappingConfig if present
  for (const key of RATING_KEYS) {
    if (key === 'OVR') continue; // compute later
    if (typeof ratings[key] === 'number' && ratings[key] > 0) continue;

    const rule = mapCfg[key]; // { a0: number, w: { SRR:0.2, ... } }
    if (rule && typeof rule === 'object') {
      const a0 = Number(rule.a0 ?? 0);
      let val = a0;
      if (rule.w && typeof rule.w === 'object') {
        for (const [sk, w] of Object.entries(rule.w)) {
          const sVal = subsetClean[sk.toUpperCase()];
          if (typeof sVal === 'number') val += Number(w) * sVal;
        }
      }
      ratings[key] = clamp99(val);
      continue;
    }

    // Heuristic fallback: copy the nearest subset signal by position family
    ratings[key] = fallbackFill(position, key, subsetClean);
  }

  // Apply devCap if present (soft cap: compress beyond cap)
  if (typeof devCap === 'number') {
    for (const k of RATING_KEYS) {
      if (k === 'OVR') continue;
      const r = ratings[k];
      ratings[k] = r <= devCap ? r : clamp99(devCap + 0.5 * (r - devCap)); // gentle squeeze above cap
    }
  }

  // Compute OVR (coarse default; you can tune per-position weights later)
  ratings.OVR = computeOVR(position, ratings);

  return { ratings, ovr: ratings.OVR, archetypeMeta: { name: arch.name, position: arch.position } };
}

function computeOVR(position: string, R: Record<RatingKey, number>): number {
  const pos = position.toUpperCase();
  const avg = (...ks: RatingKey[]) => ks.reduce((s,k)=>s+R[k],0) / ks.length;

  switch (pos) {
    case 'QB': return clamp99(0.25*R.THP + 0.15*R.SAC + 0.15*R.MAC + 0.10*R.DAC + 0.10*R.TUP + 0.10*R.AWR + 0.10*R.RUN + 0.05*R.BSK);
    case 'WR': return clamp99(0.20*R.SPD + 0.15*R.ACC + 0.15*R.CTH + 0.10*R.SPC + 0.10*avg('SRR','MRR','DRR') + 0.10*R.RLS + 0.05*R.AGI + 0.05*R.JMP + 0.10*R.AWR);
    case 'HB': return clamp99(0.18*R.SPD + 0.16*R.ACC + 0.12*R.AGI + 0.10*R.BCV + 0.10*R.BTK + 0.08*R.CAR + 0.06*R.JKM + 0.06*R.SPM + 0.04*R.SFA + 0.10*R.AWR);
    case 'TE': return clamp99(0.16*R.SPD + 0.14*R.CTH + 0.10*R.SPC + 0.10*avg('SRR','MRR') + 0.10*R.RBK + 0.10*R.PBK + 0.08*R.STR + 0.07*R.RLS + 0.05*R.JMP + 0.10*R.AWR);
    case 'LT': case 'LG': case 'C': case 'RG': case 'RT':
      return clamp99(0.25*R.RBK + 0.25*R.PBK + 0.10*R.RBP + 0.10*R.RBF + 0.10*R.PBP + 0.10*R.PBF + 0.10*R.STR);
    case 'LEDG': case 'REDG': case 'DT':
      return clamp99(0.22*R.PMV + 0.18*R.FMV + 0.15*R.BSH + 0.12*R.STR + 0.10*R.PUR + 0.10*R.PRC + 0.13*R.TAK);
    case 'SAM': case 'MIKE': case 'WILL':
      return clamp99(0.18*R.TAK + 0.14*R.PRC + 0.14*R.BSH + 0.12*R.PUR + 0.10*R.ZCV + 0.08*R.MCV + 0.08*R.SPD + 0.08*R.ACC + 0.08*R.STR);
    case 'CB':
      return clamp99(0.22*R.MCV + 0.18*R.ZCV + 0.14*R.SPD + 0.10*R.ACC + 0.10*R.PRS + 0.08*R.AGI + 0.08*R.JMP + 0.10*R.AWR);
    case 'FS': case 'SS':
      return clamp99(0.20*R.ZCV + 0.16*R.MCV + 0.14*R.TAK + 0.10*R.PRC + 0.10*R.PUR + 0.10*R.SPD + 0.08*R.ACC + 0.12*R.AWR);
    case 'K': return clamp99(0.60*R.KPW + 0.40*R.KAC);
    case 'P': return clamp99(0.70*R.KPW + 0.30*R.KAC);
    default:  return clamp99(avg(...(['SPD','ACC','AWR','STR','AGI','PRC'] as RatingKey[])));
  }
}

function fallbackFill(position: string, key: RatingKey, subset: Record<string, number>): number {
  const K = key.toUpperCase();
  const pick = (...cands: string[]) => {
    for (const c of cands) {
      const v = subset[c.toUpperCase()];
      if (typeof v === 'number') return v;
    }
    // last resort: mean of all subset values
    const vals = Object.values(subset);
    return vals.length ? clamp99(vals.reduce((s,n)=>s+n,0)/vals.length) : 50;
  };

  switch (K) {
    case 'ACC': return pick('SPD','AGI');
    case 'AGI': return pick('COD','ACC');
    case 'JKM': return pick('AGI','COD');
    case 'SPC': return pick('CTH','JMP');
    case 'SRR': case 'MRR': case 'DRR': return pick('CTH','RLS','SPD');
    case 'PBK': case 'PBP': case 'PBF': case 'RBK': case 'RBP': case 'RBF': return pick('STR','AWR');
    case 'MCV': case 'ZCV': case 'PRS': return pick('SPD','ACC','AWR');
    case 'FMV': case 'PMV': return pick('STR','BSH');
    case 'TAK': return pick('POW','STR','AWR');
    default: return pick(K);
  }
}

function safeParseJSON<T>(s?: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}