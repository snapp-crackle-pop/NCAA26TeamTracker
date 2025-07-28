import { clamp99, type RatingKey } from './ratings';

export default function computeOVR(position: string, R: Record<RatingKey, number>): number {
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