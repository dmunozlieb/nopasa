import type { DeadlineType } from '../../domain/deadline/deadline.schema';

/** Pure type→description used to prefill the subtitle. Period-agnostic on purpose
 *  (no "anual") and informative beyond the type name. OTHER has no default. */
const SUBTITLES: Record<DeadlineType, string> = {
  ITV: 'Inspección técnica del coche',
  DNI: 'Documento nacional de identidad',
  PASSPORT: 'Documento para viajar fuera de la UE',
  DRIVING_LICENSE: 'Permiso de conducir',
  INSURANCE: 'Póliza de seguro',
  SUBSCRIPTION: 'Suscripción',
  WARRANTY: 'Garantía del producto',
  GAS_INSPECTION: 'Revisión del gas',
  OTHER: '',
};

export function defaultSubtitle(type: DeadlineType): string {
  return SUBTITLES[type];
}
