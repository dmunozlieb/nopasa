import type { DeadlineType } from '../../domain/deadline/deadline.schema';

export interface DetailPresentation {
  verb: string;
  consequence: string;
  primaryAction: string;
  secondaryAction: string;
  manage: { label: string; targetStatus: 'RESOLVED' | 'CANCELLED' };
}

/** Per-type copy for the detail screen. Consequences are calm and factual (no figures,
 *  no alarm) so they read well whether the status block is red, amber or green. */
const PRESENTATIONS: Record<DeadlineType, DetailPresentation> = {
  ITV: {
    verb: 'Caduca',
    consequence: 'La ITV en vigor es necesaria para circular con el coche.',
    primaryAction: 'Reservar cita de ITV cerca',
    secondaryAction: 'Ver estaciones cercanas',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  DNI: {
    verb: 'Caduca',
    consequence: 'El DNI en vigor te permite identificarte y viajar por la UE.',
    primaryAction: 'Pedir cita para renovar el DNI',
    secondaryAction: 'Ver oficinas cercanas',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  PASSPORT: {
    verb: 'Caduca',
    consequence: 'El pasaporte en vigor es necesario para viajar fuera de la UE.',
    primaryAction: 'Pedir cita para el pasaporte',
    secondaryAction: 'Ver oficinas cercanas',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  DRIVING_LICENSE: {
    verb: 'Caduca',
    consequence: 'El permiso en vigor es necesario para poder conducir.',
    primaryAction: 'Renovar el permiso de conducir',
    secondaryAction: 'Ver centros cercanos',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  INSURANCE: {
    verb: 'Vence',
    consequence: 'El seguro en vigor mantiene tu cobertura; al renovar puedes revisar el precio.',
    primaryAction: 'Renovar o comparar el seguro',
    secondaryAction: 'Ver mi póliza',
    manage: { label: 'Marcar como renovado', targetStatus: 'RESOLVED' },
  },
  SUBSCRIPTION: {
    verb: 'Se cobra',
    consequence: 'Se renueva sola en esta fecha; puedes gestionarla o cancelarla cuando quieras.',
    primaryAction: 'Gestionar o cancelar',
    secondaryAction: 'Ver todas mis suscripciones',
    manage: { label: 'Marcar como cancelada', targetStatus: 'CANCELLED' },
  },
  WARRANTY: {
    verb: 'Termina',
    consequence: 'Mientras la garantía siga activa, las reparaciones cubiertas no te cuestan.',
    primaryAction: 'Ver mi garantía',
    secondaryAction: 'Contactar con el servicio técnico',
    manage: { label: 'Marcar como resuelta', targetStatus: 'RESOLVED' },
  },
  GAS_INSPECTION: {
    verb: 'Vence',
    consequence: 'La revisión periódica del gas es obligatoria y ayuda a mantener la instalación segura.',
    primaryAction: 'Reservar revisión de gas',
    secondaryAction: 'Ver técnicos cercanos',
    manage: { label: 'Marcar como hecha', targetStatus: 'RESOLVED' },
  },
  OTHER: {
    verb: 'Vence',
    consequence: 'Te avisaremos con tiempo para que puedas ocuparte de ello.',
    primaryAction: 'Gestionar este vencimiento',
    secondaryAction: 'Ver detalles',
    manage: { label: 'Marcar como resuelto', targetStatus: 'RESOLVED' },
  },
};

export function detailPresentation(type: DeadlineType): DetailPresentation {
  return PRESENTATIONS[type];
}
