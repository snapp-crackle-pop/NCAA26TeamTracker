export const RATING_KEYS = [
    'OVR','SPD','ACC','AGI','COD','STR','AWR','CAR','BCV','BTK','TRK','SFA','SPM','JKM',
    'CTH','CIT','SPC','SRR','MRR','DRR','RLS','JMP',
    'THP','SAC','MAC','DAC','RUN','TUP','BSK','PAC',
    'PBK','PBP','PBF','RBK','RBP','RBF','LBK','ILB',
    'PRC','TAK','POW','BSH','FMV','PMV','PUR','MCV','ZCV','PRS',
    'RET','KPW','KAC','STA','TGH','INJ','LSP'
  ] as const;
  export type RatingKey = typeof RATING_KEYS[number];
  
  export function emptyRatings(): Record<RatingKey, number> {
    const out = Object.create(null) as Record<RatingKey, number>;
    for (const k of RATING_KEYS) out[k] = 0;
    return out;
  }
  
  export function clamp99(n: number) { return Math.max(0, Math.min(99, Math.round(n))); }