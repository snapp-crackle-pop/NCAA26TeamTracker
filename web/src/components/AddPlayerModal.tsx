'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DEV_TRAITS, POSITIONS, deriveEnrollmentYear, sanitizeStr, type ClassYear } from '@/lib/enums';

type ArchetypeLite = { id: string; position: string; name: string; subsetKeys: string[] };

const FormSchema = z.object({
  name: z.string().min(1),
  position: z.string(),
  archetypeId: z.string().min(1),
  classYear: z.enum(['Freshman','Sophomore','Junior','Senior']),
  redshirt: z.boolean().optional(),
  heightIn: z.coerce.number().int().min(55).max(90).optional(),
  weightLb: z.coerce.number().int().min(120).max(400).optional(),
  handedness: z.enum(['R','L']).optional(),
  sourceType: z.enum(['Recruiting','Transfer Portal','Existing Roster']),
  devTrait: z.enum(DEV_TRAITS),
  devCap: z.coerce.number().int().min(0).max(99).optional(),
  subset: z.record(z.string(), z.coerce.number().int().min(0).max(99)).optional()
});

export function AddPlayerModal({
  open, onClose, registryYear
}: { open: boolean; onClose: () => void; registryYear: number; }) {
  const [archetypes, setArchetypes] = React.useState<ArchetypeLite[]>([]);
  const [filtered, setFiltered] = React.useState<ArchetypeLite[]>([]);
  const [subsetKeys, setSubsetKeys] = React.useState<string[]>([]);

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } =
    useForm<z.infer<typeof FormSchema>>({ resolver: zodResolver(FormSchema), defaultValues: {
      sourceType: 'Recruiting', devTrait: 'Normal', classYear: 'Freshman'
    }});

  const position = watch('position');
  const archetypeId = watch('archetypeId');

  React.useEffect(() => {
    fetch('/api/archetypes').then(r => r.json()).then((rows: ArchetypeLite[]) => {
      setArchetypes(rows);
      setFiltered(rows);
    });
  }, []);

  React.useEffect(() => {
    setFiltered(archetypes.filter(a => !position || a.position === position));
  }, [position, archetypes]);

  React.useEffect(() => {
    const a = archetypes.find(a => a.id === archetypeId);
    setSubsetKeys(a?.subsetKeys ?? []);
  }, [archetypeId, archetypes]);

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    const name = sanitizeStr(values.name);
    const enrollmentYear = deriveEnrollmentYear(registryYear, values.classYear as ClassYear, !!values.redshirt);

    // Server owns final sanitize/derive, but we do it client-side too
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        name,
        position: values.position,
        archetypeId: values.archetypeId,
        heightIn: values.heightIn ?? undefined,
        weightLb: values.weightLb ?? undefined,
        handedness: values.handedness ?? undefined,
        sourceType: values.sourceType,
        devTrait: values.devTrait,
        devCap: values.devCap ?? undefined,
        enrollmentYear,
        redshirt: !!values.redshirt,
        // subset ratings captured; the prediction service will use them
        subset: values.subset ?? {},
        season: registryYear,         // <-- add this
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      alert(`Failed to add player: ${txt}`);
      return;
    }
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-[640px] max-w-[95vw] bg-neutral-900 border border-neutral-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Add Player</h2>
          <button onClick={onClose} className="px-2 py-1 rounded bg-neutral-800">Close</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input {...register('name')} className="w-full bg-neutral-800 px-2 py-1 rounded" />
              {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm mb-1">Source</label>
              <select {...register('sourceType')} className="w-full bg-neutral-800 px-2 py-1 rounded">
                <option>Recruiting</option>
                <option>Transfer Portal</option>
                <option>Existing Roster</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Position</label>
              <select {...register('position')} className="w-full bg-neutral-800 px-2 py-1 rounded">
                <option value="">Select…</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Archetype</label>
              <select {...register('archetypeId')} className="w-full bg-neutral-800 px-2 py-1 rounded">
                <option value="">Select…</option>
                {filtered.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Class @ {registryYear}</label>
              <select {...register('classYear')} className="w-full bg-neutral-800 px-2 py-1 rounded">
                <option>Freshman</option><option>Sophomore</option>
                <option>Junior</option><option>Senior</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" {...register('redshirt')} />
              <span className="text-sm">Redshirt</span>
            </div>

            <div>
              <label className="block text-sm mb-1">Height (in)</label>
              <input type="number" {...register('heightIn')} className="w-full bg-neutral-800 px-2 py-1 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Weight (lb)</label>
              <input type="number" {...register('weightLb')} className="w-full bg-neutral-800 px-2 py-1 rounded" />
            </div>

            <div>
              <label className="block text-sm mb-1">Handedness</label>
              <select {...register('handedness')} className="w-full bg-neutral-800 px-2 py-1 rounded">
                <option value="">—</option><option value="R">R</option><option value="L">L</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Dev Trait</label>
              <select {...register('devTrait')} className="w-full bg-neutral-800 px-2 py-1 rounded">
                {DEV_TRAITS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Dev Cap (0–99)</label>
              <input type="number" {...register('devCap')} className="w-full bg-neutral-800 px-2 py-1 rounded" />
            </div>
          </div>

          {/* Dynamic subset inputs */}
          {subsetKeys.length > 0 && (
            <div>
              <div className="font-medium mb-1">Archetype Subset Ratings</div>
              <div className="grid grid-cols-3 gap-2">
                {subsetKeys.map(k => (
                  <div key={k}>
                    <label className="block text-xs mb-1">{k}</label>
                    <input
                      type="number"
                      {...register(`subset.${k}` as const)}
                      className="w-full bg-neutral-800 px-2 py-1 rounded"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-neutral-800">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-3 py-1 rounded bg-emerald-700">
              {isSubmitting ? 'Saving…' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}