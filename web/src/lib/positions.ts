export const OFF_POSITIONS = [
    'QB','HB','FB','WR','TE','LT','LG','C','RG','RT'
  ] as const;
  
  export const DEF_POSITIONS = [
    'LEDG','REDG','DT','SAM','MIKE','WILL','CB','FS','SS'
  ] as const;
  
  export type OffPos = typeof OFF_POSITIONS[number];
  export type DefPos = typeof DEF_POSITIONS[number];
  
  export function sidePositions(side: 'OFF'|'DEF') {
    return side === 'OFF' ? [...OFF_POSITIONS] : [...DEF_POSITIONS];
  }
  
  export function ovrBand(ovr?: number) {
    if (ovr == null) return 'bg-neutral-700';
    if (ovr >= 90) return 'bg-yellow-400';
    if (ovr >= 80) return 'bg-lime-400';
    if (ovr >= 75) return 'bg-green-400';
    if (ovr >= 70) return 'bg-amber-400';
    if (ovr >= 65) return 'bg-orange-400';
    if (ovr >= 60) return 'bg-orange-600';
    return 'bg-red-600';
  }
  
  export function classFrom(season: number, enroll: number, redshirt: boolean) {
    const rs = redshirt ? 1 : 0;
    const y = season - enroll - rs;
    if (y <= 0) return 'Fr';
    if (y === 1) return 'So';
    if (y === 2) return 'Jr';
    return 'Sr';
  }