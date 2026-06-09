import type { DeadlineType } from '../../domain/deadline/deadline.schema';

/** Short ES label for the type chips. Terminology unified with the Detail screen
 *  ("Permiso", "Gas"); kept short so the 3-per-row grid does not wrap awkwardly. */
const LABELS: Record<DeadlineType, string> = {
  ITV: 'ITV',
  DNI: 'DNI',
  PASSPORT: 'Pasaporte',
  DRIVING_LICENSE: 'Permiso',
  INSURANCE: 'Seguro',
  SUBSCRIPTION: 'Suscripción',
  WARRANTY: 'Garantía',
  GAS_INSPECTION: 'Gas',
  OTHER: 'Otro',
};

export function typeLabel(type: DeadlineType): string {
  return LABELS[type];
}
