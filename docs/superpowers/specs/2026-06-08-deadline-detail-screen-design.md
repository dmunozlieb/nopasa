# Pantalla de detalle de un vencimiento — Diseño

**Fecha:** 2026-06-08
**Alcance:** pantalla de detalle (ruta `deadline/[id]`), cargando el vencimiento del
repositorio por id, con contenido adaptado por tipo y la capa de acción.

## Contexto

El dominio, la persistencia y la pantalla de inicio están hechos y testeados (93 tests).
Se reutilizan, sin reconstruir:

- `RepositoryProvider` / `useDeadlineRepository` (`src/ui/repository/`).
- Tokens de tema (`src/ui/theme/`).
- Mapeos: `urgencyColors`, `typeIcon`, `formatTimeRemaining`, `groupLabel`
  (`src/ui/deadline/`).
- Componentes: `AppText`, `Card`, `Button`, `Pill`, `Loading`, headers.
- Dominio: `Deadline`, `DeadlineType` (9 tipos), `DeadlineStatus`
  (`ACTIVE | RESOLVED | CANCELLED`), `daysRemaining`, `urgencyLevel`.
- Puerto `DeadlineRepository` (`findById`, `update`).
- La home refresca al enfocar (`useFocusEffect`), así que tras cambiar el status y
  volver, el ítem desaparece de la lista automáticamente.

**No se toca** ni el dominio ni la firma del puerto. La pantalla depende de la interfaz
`DeadlineRepository`, nunca de la implementación SQLite.

### Fuera de alcance

Cámara, OCR, flujo de añadir, notificaciones (por eso "Posponer el aviso" es
placeholder), las integraciones reales de la capa de acción (reservar/comparar/gestionar
→ placeholders), iOS. El bottom-sheet arrastrable real queda para más adelante.

## Decisiones tomadas

- **Presentación:** ruta modal de Expo Router (`presentation: 'modal'`, ya configurada
  en `app/_layout.tsx`). Aspecto de hoja: contenedor con esquinas superiores
  redondeadas + barra de "agarre" decorativa, sobre `screenBg`.
- **Navegación por callback:** la pantalla recibe `onClose` por prop (como `HomeScreen`),
  para ser testeable sin un contenedor de navegación. La ruta fina inyecta
  `onClose={() => router.back()}`.
- **Consecuencia:** una por tipo (no por urgencia). Redactada en tono calmado y factual,
  nunca alarmista, de modo que lea bien tanto si el bloque sale en rojo (urgente) como en
  verde (tranquilo). El color del bloque transmite la gravedad; el texto solo informa.
- **Importe explícito:** línea de importe en el detalle, derivada de `amount`/`amountLabel`
  mediante un helper compartido con la home (coherencia de formato).

## Estructura de ficheros

```
app/deadline/[id].tsx                 # ruta fina: useLocalSearchParams + useRouter
src/ui/deadline/
  detail-presentation.ts              # config pura por tipo (núcleo de cobertura)
  status-headline.ts                  # verbo + countdown (reutiliza formatTimeRemaining)
  format-date.ts                      # "11 jun 2026" (meses ES, sin Intl)
  format-amount.ts                    # formatAmountLine(deadline) compartido con la home
src/ui/hooks/
  use-deadline.ts                     # findById -> loading/error/not-found/ready
src/ui/components/
  ActionButton.tsx                    # fila de acción (icono + etiqueta + chevron)
  DetailStatusBlock.tsx               # bloque de estado tintado por urgencia
  ManageAction.tsx                    # acción de gestión de bajo peso
src/ui/screens/
  DeadlineDetailScreen.tsx            # composición de la pantalla
```

Modificado (refactor menor, ver más abajo): `src/ui/components/DeadlineRow.tsx`.

## Config de presentación por tipo (núcleo puro) — `detail-presentation.ts`

```ts
interface DetailPresentation {
  verb: string;                 // Caduca | Vence | Se cobra | Termina
  consequence: string;          // frase calmada, factual, por tipo
  primaryAction: string;        // etiqueta del botón primario
  secondaryAction: string;      // etiqueta del botón secundario
  manage: { label: string; targetStatus: 'RESOLVED' | 'CANCELLED' };
}

export function detailPresentation(type: DeadlineType): DetailPresentation;
```

Una entrada por cada uno de los 9 `DeadlineType`. Test de cobertura total: para cada
tipo, `verb`/`consequence`/`primaryAction`/`secondaryAction`/`manage.label` no vacíos y
`manage.targetStatus` correcto (CANCELLED solo en suscripción; RESOLVED en el resto).

### Tabla completa de copy (revisable)

| Tipo | verb | consequence | primaryAction | secondaryAction | manage.label | targetStatus |
|------|------|-------------|---------------|-----------------|--------------|--------------|
| ITV | Caduca | La ITV en vigor es necesaria para circular con el coche. | Reservar cita de ITV cerca | Ver estaciones cercanas | Marcar como renovado | RESOLVED |
| DNI | Caduca | El DNI en vigor te permite identificarte y viajar por la UE. | Pedir cita para renovar el DNI | Ver oficinas cercanas | Marcar como renovado | RESOLVED |
| PASSPORT | Caduca | El pasaporte en vigor es necesario para viajar fuera de la UE. | Pedir cita para el pasaporte | Ver oficinas cercanas | Marcar como renovado | RESOLVED |
| DRIVING_LICENSE | Caduca | El permiso en vigor es necesario para poder conducir. | Renovar el permiso de conducir | Ver centros cercanos | Marcar como renovado | RESOLVED |
| INSURANCE | Vence | El seguro en vigor mantiene tu cobertura; al renovar puedes revisar el precio. | Renovar o comparar el seguro | Ver mi póliza | Marcar como renovado | RESOLVED |
| SUBSCRIPTION | Se cobra | Se renueva sola en esta fecha; puedes gestionarla o cancelarla cuando quieras. | Gestionar o cancelar | Ver todas mis suscripciones | Marcar como cancelada | CANCELLED |
| WARRANTY | Termina | Mientras la garantía siga activa, las reparaciones cubiertas no te cuestan. | Ver mi garantía | Contactar con el servicio técnico | Marcar como resuelta | RESOLVED |
| GAS_INSPECTION | Vence | La revisión periódica del gas es obligatoria y ayuda a mantener la instalación segura. | Reservar revisión de gas | Ver técnicos cercanos | Marcar como hecha | RESOLVED |
| OTHER | Vence | Te avisaremos con tiempo para que puedas ocuparte de ello. | Gestionar este vencimiento | Ver detalles | Marcar como resuelto | RESOLVED |

> Las consecuencias son factuales y sin alarmismo a propósito: ninguna cita cifras ni
> amenazas; la cifra concreta vive en la línea de importe y la gravedad la da el color.

## Helpers puros

- **`statusHeadline(verb: string, days: number): string`** (`status-headline.ts`),
  reutiliza `formatTimeRemaining`:
  - `days > 0` → `"{verb} en {formatTimeRemaining(days)}"` (p.ej. "Caduca en 4 días")
  - `days === 0` → `"{verb} hoy"`
  - `days < 0` → `"Vencido"`
  Resuelve los casos que `"{verb} en …"` rompería (hoy/vencido). Testeado.
- **`formatDate(date: Date): string`** (`format-date.ts`) → `"11 jun 2026"`. Meses en
  español con array fijo (`['ene','feb',…]`), determinista, sin `Intl`/locale. Testeado
  (varios meses + días de un dígito).
- **`formatAmountLine(deadline: Deadline): string | null`** (`format-amount.ts`):
  - `deadline.amount == null` → `null` (sin importe → se oculta la línea).
  - si hay `amountLabel` → devuelve `amountLabel` (en los datos actuales ya incluye la
    cifra: "multa 200 €", "12,99 €/mes", "487 €/año").
  - si solo hay `amount` → `"{amount con coma decimal} €"` (p.ej. 200 → "200 €",
    12.99 → "12,99 €").
  Testeado (con label, solo amount, sin amount).

### Refactor de coherencia (`DeadlineRow`)

`DeadlineRow` (home) hoy renderiza `deadline.amountLabel` inline. Se cambia para usar
`formatAmountLine(deadline)` (misma fuente de formato que el detalle). No cambia el
comportamiento de los ítems con `amountLabel`; el test existente de la home (que comprueba
"multa 200 €") sigue pasando. Solo añade el caso "solo amount" → "200 €".

## Hook — `use-deadline.ts`

`useDeadline(id: string)` usa `useDeadlineRepository().findById(id)`. Estados:
`'loading' | 'error' | 'not-found' | 'ready'` (distingue `null` = not-found de excepción
= error). Devuelve `{ status, deadline }`. Carga en montaje.

## Componentes (reutilizo lo existente; añado los justos)

- **`ActionButton`**: `Pressable` con icono (izquierda) + etiqueta + chevron (derecha),
  `variant: 'primary' | 'secondary'`. Primary = fondo `brandBlue`/texto blanco; secondary
  = fondo `cardBg`/texto oscuro con sombra suave (estilo `Card`). Alineado a la izquierda,
  con chevron — distinto del `Button` centrado de la home, por eso es un componente
  aparte (no se sobrecarga `Button`). Reutiliza `AppText`/tema/`MaterialCommunityIcons`.
- **`DetailStatusBlock`**: bloque con fondo `urgencyColors(level).tintBg`, redondeado.
  `statusHeadline` en grande (color `urgencyColors(level).base`), `formatDate(dueDate)`
  debajo, divisor fino, y la `consequence` con icono ⓘ. Recibe el nivel y los textos ya
  resueltos (presentacional).
- **`ManageAction`**: `Pressable` de bajo peso (icono + etiqueta en tono apagado) para
  las acciones de gestión.

## Pantalla — `DeadlineDetailScreen.tsx`

Props `{ id: string; onClose: () => void }`. Usa `useDeadline(id)` y
`useDeadlineRepository()` (para `update`). Insets de safe-area (mock de tests ya global).

- `loading` → `<Loading/>`.
- `error` → mensaje "No se pudo cargar este vencimiento." + acción de cerrar.
- `not-found` → mensaje "No encontramos este vencimiento." + acción de cerrar.
- `ready`:
  1. **Handle** decorativo + cabecera: icono tintado por urgencia
     (`urgencyColors(level).tintBg`/`base`, `typeIcon(type)`) + título + subtítulo.
  2. **`DetailStatusBlock`**: `statusHeadline(verb, daysRemaining)`, `formatDate(dueDate)`,
     `consequence`. `level = urgencyLevel(deadline, today)`.
  3. **Línea de importe**: si `formatAmountLine(deadline)` no es null, una fila (icono de
     importe + texto) cerca del bloque de estado. Oculta si no hay importe.
  4. **"Qué puedes hacer"**: `ActionButton` primario (azul) + secundario, con
     `primaryAction`/`secondaryAction`. Handlers **placeholder** (aviso "Próximamente"
     vía `Alert`).
  5. **Divisor** + **gestión** (menos peso): `ManageAction` **"{manage.label}"**
     *funcional* y `ManageAction` **"Posponer el aviso"** *placeholder*.

**Acción de gestión (funcional):** al pulsar "{manage.label}", llama a
`repository.update({ ...deadline, status: manage.targetStatus })` y luego `onClose()`.
Al volver, la home refresca al enfocar y el ítem (ya no ACTIVE) desaparece.

## Tests

Maximizar lo puro. Patrón TDD. Stack: `@testing-library/react-native` v14 (`render()` es
async → `await render`), mock global de safe-area ya presente.

- **Puro (cobertura total):**
  - `detail-presentation`: los 9 tipos (verbo, consecuencia no vacía, etiquetas, manage
    label + targetStatus; CANCELLED solo en SUBSCRIPTION).
  - `status-headline`: `>0`, `=0`, `<0`.
  - `format-date`: varios meses + día de un dígito.
  - `format-amount`: con `amountLabel`, solo `amount`, sin importe.
- **Componentes (RNTL):** `DeadlineDetailScreen` con repo inyectado:
  - ITV → "Caduca …", consecuencia, ambas etiquetas de acción, gestión "Marcar como
    renovado", y la línea de importe ("multa 200 €").
  - Suscripción → "Se cobra …", gestión "Marcar como cancelada".
  - **not-found** → mensaje de no encontrado.
- **Integración:** pulsar "{manage.label}" llama a `repository.update` con el
  `targetStatus` correcto y llama a `onClose` — con `InMemoryDeadlineRepository` vía
  `RepositoryProvider`. Verifica el status persistido (`findById` tras el update) y la
  llamada a `onClose`.

## Calidad

- No cambiar el dominio ni la firma del puerto.
- La pantalla depende de la interfaz `DeadlineRepository` (`findById`/`update`), no de la
  implementación.
- Reutilizar tokens/componentes/hooks; añadir solo `ActionButton`, `DetailStatusBlock`,
  `ManageAction` y los helpers puros. Refactor mínimo de `DeadlineRow` para coherencia de
  importe.
- Componentes pequeños, con una responsabilidad clara y testeables por separado.
