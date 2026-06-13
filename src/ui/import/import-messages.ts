import type { ImportSchemaError } from '../../domain/import/parse-deadline-import';

/** Spanish message for a whole-file import rejection. */
export function importErrorMessage(code: ImportSchemaError): string {
  switch (code) {
    case 'unreadable':
      return 'No pudimos leer el archivo. ¿Seguro que es una copia de Nopasa?';
    case 'unsupported-version':
      return 'Este archivo es de una versión no compatible de Nopasa.';
  }
}

interface ImportCounts {
  imported: number;
  alreadyExisted: number;
  invalidCount: number;
}

/** Itemized result line, hiding the zero parts:
 *  "Importados N" [· M ya existían] [· K no válidos]. */
export function importResultMessage({ imported, alreadyExisted, invalidCount }: ImportCounts): string {
  let message = `Importados ${imported}`;
  if (alreadyExisted > 0) message += ` · ${alreadyExisted} ya existían`;
  if (invalidCount > 0) message += ` · ${invalidCount} no válidos`;
  return message;
}
