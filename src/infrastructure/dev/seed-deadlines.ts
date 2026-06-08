import { randomUUID } from 'expo-crypto';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { deadlineSchema } from '../../domain/deadline/deadline.schema';
import type { DeadlineRepository } from '../../ports/deadline-repository';

/**
 * TEMPORARY / REMOVABLE dev-only seed. Populates the list with sample deadlines so the
 * home screen is visible before the "add" flow exists. Delete this file (and its call in
 * RepositoryProvider) once adding deadlines works.
 */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function sample(): Deadline[] {
  const now = new Date();
  const make = (partial: Omit<Deadline, 'id' | 'createdAt' | 'status' | 'reminderDaysBefore'>): Deadline =>
    deadlineSchema.parse({
      id: randomUUID(),
      createdAt: now,
      status: 'ACTIVE',
      reminderDaysBefore: [30, 7],
      ...partial,
    });

  return [
    make({ type: 'ITV', title: 'ITV — Clio', subtitle: 'Inspección técnica del coche', dueDate: daysFromNow(4), amount: 200, amountLabel: 'multa 200 €' }),
    make({ type: 'INSURANCE', title: 'Seguro del coche', subtitle: 'Renovación anual', dueDate: daysFromNow(6), amount: 487, amountLabel: '487 €/año' }),
    make({ type: 'DNI', title: 'DNI — Marta', subtitle: 'Documento de identidad', dueDate: daysFromNow(9) }),
    make({ type: 'SUBSCRIPTION', title: 'Netflix', subtitle: 'Suscripción mensual', dueDate: daysFromNow(14), amount: 12.99, amountLabel: '12,99 €/mes' }),
    make({ type: 'GAS_INSPECTION', title: 'Revisión de la caldera', subtitle: 'Revisión obligatoria de gas', dueDate: daysFromNow(31) }),
    make({ type: 'PASSPORT', title: 'Pasaporte — Marta', subtitle: 'Documento de viaje', dueDate: daysFromNow(200) }),
  ];
}

/** Inserts the sample deadlines only when the store is empty. No-op outside __DEV__. */
export async function seedDeadlinesIfEmpty(repo: DeadlineRepository): Promise<void> {
  if (!__DEV__) return;
  const existing = await repo.list();
  if (existing.length > 0) return;
  for (const deadline of sample()) {
    await repo.save(deadline);
  }
}
