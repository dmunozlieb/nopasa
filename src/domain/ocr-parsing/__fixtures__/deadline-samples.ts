import type { RecognizedText } from '../../../ports/text-recognizer';
import type { DeadlineHints } from '../deadline-hints';

export interface DeadlineSample {
  name: string;
  recognized: RecognizedText;
  now: Date;
  expected: DeadlineHints;
}

/** Wrap a multi-line block as RecognizedText (text + line array). */
function recognized(text: string): RecognizedText {
  return { text, lines: text.split('\n') };
}

const NOW = new Date(2026, 5, 13, 14, 30); // 2026-06-13 14:30

export const DEADLINE_SAMPLES: DeadlineSample[] = [
  {
    // ANCHOR: real DNI OCR noise preserved (lost space "NACIONALDE", line order, "07 12 2021"
    // emission), PII replaced with same-format fakes. Validity (2031) future > emission (2021) past.
    name: 'dni-anonymized',
    recognized: recognized(
      [
        'ESPANA',
        'DOCUMENTO NACIONALDE IDENTIDAD',
        'APELLIDOS',
        'GARCIA EJEMPLO',
        'NOMBRE',
        'MARIA',
        'IDESP',
        'BAA000000',
        'VALIDEZ',
        '14 03 2031',
        'DNI 00000000T',
        '07 12 2021',
      ].join('\n'),
    ),
    now: NOW,
    expected: { type: 'DNI', dueDate: new Date(2031, 2, 14) },
  },
  {
    name: 'itv',
    recognized: recognized(
      [
        'INSPECCION TECNICA DE VEHICULOS',
        'ESTACION ITV',
        'MATRICULA 1234 ABC',
        'FECHA INSPECCION 10 05 2026',
        'PROXIMA INSPECCION',
        '10 05 2028',
        'FAVORABLE',
      ].join('\n'),
    ),
    now: NOW,
    expected: { type: 'ITV', dueDate: new Date(2028, 4, 10) },
  },
  {
    // Premium (263,38) appears BEFORE the larger capital (150.000,00): "first" picks the premium.
    name: 'insurance',
    recognized: recognized(
      [
        'SEGURO DE HOGAR',
        'POLIZA N 1234567',
        'PRIMA ANUAL 263,38 €',
        'CAPITAL ASEGURADO 150.000,00 €',
        'FECHA DE EFECTO 01 07 2025',
        'VENCIMIENTO 01 07 2027',
      ].join('\n'),
    ),
    now: NOW,
    expected: { type: 'INSURANCE', dueDate: new Date(2027, 6, 1), amount: 263.38 },
  },
  {
    name: 'subscription',
    recognized: recognized(
      ['SUSCRIPCION PREMIUM', 'PLAN ANUAL', 'IMPORTE 89,99 €', 'RENOVACION 15 03 2027'].join('\n'),
    ),
    now: NOW,
    expected: { type: 'SUBSCRIPTION', dueDate: new Date(2027, 2, 15), amount: 89.99 },
  },
  {
    name: 'passport',
    recognized: recognized(
      [
        'PASAPORTE',
        'APELLIDOS GARCIA EJEMPLO',
        'FECHA DE EXPEDICION 12 04 2020',
        'FECHA DE CADUCIDAD',
        '12 04 2030',
      ].join('\n'),
    ),
    now: NOW,
    expected: { type: 'PASSPORT', dueDate: new Date(2030, 3, 12) },
  },
  {
    // due TODAY + no recognizable type: partial result (date only). The 45,00 € is NOT
    // emitted because the type is not INSURANCE/SUBSCRIPTION (amount stays gated).
    name: 'due-today',
    recognized: recognized(['RECIBO', 'TOTAL A PAGAR 45,00 €', 'FECHA LIMITE 13 06 2026'].join('\n')),
    now: NOW,
    expected: { dueDate: new Date(2026, 5, 13) },
  },
  {
    name: 'noise-only',
    recognized: recognized(['GRACIAS POR SU COMPRA', 'HASTA LUEGO', 'WWW.EJEMPLO.COM'].join('\n')),
    now: NOW,
    expected: {},
  },
];
