export const POSITIONS = [
    'QB','HB','FB','WR','TE','LT','LG','C','RG','RT',
    'LEDG','REDG','DT','SAM','MIKE','WILL','CB','FS','SS','K','P'
  ] as const;
  export type Position = typeof POSITIONS[number];
  
  export const DEV_TRAITS = ['Normal','Impact','Star','Elite'] as const;
  export type DevTrait = typeof DEV_TRAITS[number];
  
  export type ClassYear = 'Freshman'|'Sophomore'|'Junior'|'Senior';
  
  export function deriveEnrollmentYear(registryYear: number, classYear: ClassYear, redshirt: boolean) {
    const yearsPlayed = { Freshman:0, Sophomore:1, Junior:2, Senior:3 }[classYear];
    return registryYear - yearsPlayed - (redshirt ? 1 : 0);
  }
  
  export function sanitizeStr(s?: string) {
    return (s ?? '').trim().replace(/\s+/g, ' ');
  }