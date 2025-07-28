import { PrismaClient } from '@prisma/client';
import { clamp99, RATING_KEYS, type RatingKey } from './ratings';

const prisma = new PrismaClient();

/**
 * Heuristic base growth per rating (points/season) before multipliers.
 * Tweak later in Settings; initial values are conservative.
 */
const BASE_GROWTH: Partial<Record<RatingKey, number>> = {
  // physical
  SPD: 0.6, ACC: 0.8, AGI: 0.8, COD: 0.6, STR: 1.0, JMP: 0.6,
  // ball skills / technique
  CTH: 1.2, CIT: 1.0, SPC: 1.0, SRR: 1.6, MRR: 1.6, DRR: 1.6, RLS: 1.2,
  THP: 0.6, SAC: 1.6, MAC: 1.6, DAC: 1.2, RUN: 1.2, TUP: 1.4, BSK: 1.0, PAC: 1.0,
  PBK: 1.6, PBP: 1.4, PBF: 1.4, RBK: 1.6, RBP: 1.4, RBF: 1.4, LBK: 1.0, ILB: 1.0,
  TAK: 1.4, POW: 1.0, BSH: 1.2, FMV: 1.2, PMV: 1.2, PUR: 1.2, MCV: 1.6, ZCV: 1.6, PRS: 1.2,
  KPW: 0.4, KAC: 0.8, RET: 0.6, LSP: 0.2,
  // game IQ / durability
  AWR: 2.0, PRC: 1.8, STA: 0.6, TGH: 0.4, INJ: 0.2,
  // ball carrier
  CAR: 1.0, BCV: 1.2, BTK: 1.2, TRK: 1.0, SFA: 1.0, SPM: 1.0, JKM: 1.0,
};

const DEV_MULT: Record<'Normal'|'Impact'|'Star'|'Elite', number> = {
  Normal: 1.00, Impact: 1.15, Star: 1.30, Elite: 1.45
};

/** Years since enrollment → age curve multiplier. */
function ageMult(yearsSinceEnroll: number): number {
  if (yearsSinceEnroll <= 0) return 1.20;
  if (yearsSinceEnroll === 1) return 1.10;
  if (yearsSinceEnroll === 2) return 1.00;
  if (yearsSinceEnroll === 3) return 0.70;
  return 0.40;
}

function nextSeasonRatings(current: Record<RatingKey, number>, position: string, devTrait: 'Normal'|'Impact'|'Star'|'Elite', devCap?: number | null): Record<RatingKey, number> {
  const out = { ...current };
  const dev = DEV_MULT[devTrait] ?? 1.0;

  for (const k of RATING_KEYS) {
    if (k === 'OVR') continue;
    const base = BASE_GROWTH[k] ?? 0.8;
    let g = base * dev;
    // small positional nudges
    const pos = position.toUpperCase();
    if (pos === 'QB' && (k === 'SAC' || k === 'MAC' || k === 'TUP')) g *= 1.1;
    if ((pos === 'LT'||pos==='LG'||pos==='C'||pos==='RG'||pos==='RT') && (k==='PBK'||k==='RBK')) g *= 1.1;
    if (pos === 'CB' && (k==='MCV'||k==='ZCV')) g *= 1.1;

    let v = out[k] + g;
    if (typeof devCap === 'number') v = v <= devCap ? v : devCap + 0.5 * (v - devCap);
    out[k] = clamp99(v);
  }
  return out;
}

/**
 * Ensure snapshots exist for [startYear .. startYear+horizon].
 * If no snapshot exists at or before startYear for a player who has already enrolled,
 * we create a baseline predicted snapshot at startYear so they appear at t+0.
 */
export async function ensureSnapshots(startYear: number, horizon: number) {
  const players = await prisma.player.findMany({
    select: { id:true, position:true, archetypeId:true, devTrait:true, devCap:true, enrollmentYear:true, redshirt:true }
  });

  for (const p of players) {
    const rsOffset = p.redshirt ? 1 : 0;

    // existing snapshots in window
    const snaps = await prisma.ratingSnapshot.findMany({
      where: { playerId: p.id, season: { gte: startYear, lte: startYear + horizon } },
      orderBy: { season: 'asc' }
    });
    const bySeason = new Map(snaps.map(s => [s.season, s]));

    // if we already have t+0, we’ll chain from it below
    const hasStart = bySeason.has(startYear);

    // snapshot just before startYear
    const prev = await prisma.ratingSnapshot.findFirst({
      where: { playerId: p.id, season: { lt: startYear } },
      orderBy: { season: 'desc' }
    });

    let lastRatings: Record<RatingKey, number> | null = null;
    let lastSeason: number | null = null;

    if (hasStart) {
      lastRatings = JSON.parse(bySeason.get(startYear)!.ratings);
      lastSeason = startYear;
    } else if (prev) {
      lastRatings = JSON.parse(prev.ratings);
      lastSeason = prev.season;
      // generate up to startYear
      for (let y = prev.season + 1; y <= startYear; y++) {
        const yearsSinceEnroll = y - p.enrollmentYear - rsOffset;
        const aged = scaleRatings(nextSeasonRatings(lastRatings, p.position, p.devTrait as any, p.devCap), ageMult(yearsSinceEnroll));
        const ovr = recomputeOVR(p.position, aged);
        await prisma.ratingSnapshot.create({
          data: { playerId: p.id, season: y, ratings: JSON.stringify(aged), ovr, predicted: true }
        });
        lastRatings = aged;
        lastSeason = y;
      }
    } else {
      // NEW: baseline at startYear if player is already enrolled by startYear
      if (p.enrollmentYear <= startYear && p.archetypeId) {
        const { ratings, ovr } = await baselineAtStartYear(p.id, p.position, p.archetypeId, p.devTrait as any, p.devCap ?? null);
        await prisma.ratingSnapshot.create({
          data: { playerId: p.id, season: startYear, ratings: JSON.stringify(ratings), ovr, predicted: true }
        });
        lastRatings = ratings;
        lastSeason = startYear;
      } else {
        // not enrolled yet or missing archetype: skip until they enter the window
        continue;
      }
    }

    // now ensure future years
    for (let y = startYear + 1; y <= startYear + horizon; y++) {
      if (bySeason.has(y)) { lastRatings = JSON.parse(bySeason.get(y)!.ratings); lastSeason = y; continue; }
      const yearsSinceEnroll = y - p.enrollmentYear - rsOffset;
      const aged = scaleRatings(nextSeasonRatings(lastRatings!, p.position, p.devTrait as any, p.devCap), ageMult(yearsSinceEnroll));
      const ovr = recomputeOVR(p.position, aged);
      await prisma.ratingSnapshot.create({
        data: { playerId: p.id, season: y, ratings: JSON.stringify(aged), ovr, predicted: true }
      });
      lastRatings = aged;
      lastSeason = y;
    }
  }
}

function scaleRatings(R: Record<RatingKey, number>, mult: number) {
  const out = { ...R };
  for (const k of Object.keys(out) as RatingKey[]) {
    if (k === 'OVR') continue;
    out[k] = clamp99(out[k] + (mult - 1) * 0.5); // gentle nudge
  }
  return out;
}

// Lightweight OVR (shared with predict.ts via small helper)
function recomputeOVR(position: string, R: Record<RatingKey, number>): number {
  const { default: compute } = require('./predict_ovr') as { default: (pos: string, RR: any) => number };
  return compute(position, R);
}

// NEW: baseline snapshot when no prior snapshots exist
async function baselineAtStartYear(playerId: string, position: string, archetypeId: string, devTrait: 'Normal'|'Impact'|'Star'|'Elite', devCap: number | null) {
  // Lazy import to avoid duplicate Prisma client instances in Next dev
  const { predictFromSubset } = require('./predict') as { predictFromSubset: (p: any) => Promise<{ ratings: Record<RatingKey, number>; ovr: number; }> };
  // No subset available here (older player rows), so we pass empty {}.
  const { ratings, ovr } = await predictFromSubset({
    position,
    archetypeId,
    subset: {},    // will use baseTemplate + heuristics
    devTrait,
    devCap
  });
  return { ratings, ovr };
}