# Pantalla de inicio + cimientos de UI — Diseño

**Fecha:** 2026-06-08
**Alcance:** pantalla de inicio (lista de vencimientos) cableada al `DeadlineRepository`
existente, más los cimientos de UI reutilizables (tema, mapeos, componentes) y la
navegación con Expo Router.

## Contexto

El dominio y la persistencia están terminados y testeados. No se tocan en esta sesión:

- Dominio: `groupAndSort`, `urgencyLevel`, `daysRemaining`, `Deadline`, `DeadlineType`
  (9 tipos), `DeadlineStatus`, `DeadlineGroup` (`NEEDS_ATTENTION | UPCOMING | CALM`).
- Puerto: `DeadlineRepository` (`save`, `list`, `findById`, `update`, `delete`).
- Implementación e infra: `SqliteDeadlineRepository`, `createDeadlineRepository()`.

`groupAndSort(list, today)` ya excluye RESOLVED/CANCELLED, agrupa y ordena por
`daysRemaining` ascendente. La UI **no** reimplementa nada de esto; solo presenta.

**No se toca** ni el dominio ni la firma del puerto. La pantalla depende de la
interfaz `DeadlineRepository`, nunca de la implementación SQLite concreta.

### Fuera de alcance

Resto de pantallas (detalle, añadir, confirmar foto, ajustes), cámara, OCR,
notificaciones, iOS. Existirán como **rutas placeholder** navegables.

## Decisiones tomadas

- **Acceso al repo:** Context + hook. Un `RepositoryProvider` con prop `repository?`
  opcional. Si se pasa (tests), se usa tal cual. Si no, crea el real con
  `createDeadlineRepository()` de forma asíncrona mostrando carga hasta que esté listo.
- **Recálculo de "hoy":** además del montaje, se recalcula al enfocar la pantalla
  (`useFocusEffect`) y se refrescan los grupos. Deja montado el mecanismo de recarga
  al enfocar que necesitarán añadir/detalle en sesiones futuras.
- **Iconos:** `@expo/vector-icons` (MaterialCommunityIcons).
- **Tipografía:** Nunito vía `expo-font` + `@expo-google-fonts/nunito`.

## Estructura de ficheros

```
app/
  _layout.tsx            # RepositoryProvider (sin prop) + carga de fuentes + <Stack>
  index.tsx              # ruta "/" -> contenedor HomeScreen
  deadline/[id].tsx      # placeholder detalle (presentación modal)
  add.tsx                # placeholder añadir (presentación modal)
src/ui/
  theme/                 # UNICA fuente de verdad de estilo
    colors.ts  typography.ts  spacing.ts  radii.ts  index.ts
  repository/
    repository-context.tsx     # RepositoryProvider + useDeadlineRepository()
  deadline/                    # mapeos dominio -> presentacion
    group-labels.ts
    urgency-colors.ts
    type-icons.ts
    format-time-remaining.ts
  hooks/
    use-deadlines.ts           # carga lista + groupAndSort + loading/error + reload
  components/
    AppText.tsx  Pill.tsx  Card.tsx  Button.tsx
    DeadlineRow.tsx  SectionHeader.tsx  ScreenHeader.tsx
    EmptyState.tsx  DeadlineList.tsx  Loading.tsx
  screens/
    HomeScreen.tsx
src/test-support/
  in-memory-deadline-repository.ts   # fake del puerto para tests
src/infrastructure/dev/
  seed-deadlines.ts            # SOLO __DEV__, temporal/eliminable
```

### Dependencias nuevas

A instalar verificando versiones/APIs exactas contra
https://docs.expo.dev/versions/v56.0.0/ **antes** de escribir código:

- `expo-router` (+ peers `react-native-safe-area-context`, `react-native-screens`).
- `expo-font` + `@expo-google-fonts/nunito`.
- `@expo/vector-icons` (si no viene ya resuelto por Expo).
- `@testing-library/react-native` (devDependency).

Cambios de configuración: `app.json` (`scheme`, plugin `expo-router`); `main` del
`package.json` -> `expo-router/entry` (revisar el `index.ts` actual).

## Tokens de tema (`src/ui/theme/`)

Valores extraídos del CSS de `docs/design/*.html` (marca y urgencia salen limpios) y
muestreados del PNG donde el JSX original no está en el repo (fondo de pantalla,
tarjeta, botón, pastillas). Afinar contra los PNG en implementación.

- **colors:** `text` `#2C2A26`, `textSecondary` `#5C574F`, `textMuted` `#6E6960` /
  `#8A8378`, `brandBlue` `#3E6BC8`, `screenBg` (crema, ~`#F7F4EF`), `cardBg`
  `#FFFFFF`, `surfaceSoft` `#F4F1EB`.
  Urgencia: `urgent` `#C25A45`, `upcoming` `#C2883B`, `calm` `#5F8A67`, cada uno con
  su tinte claro (`tintBg`) para fondo de pastilla y de icono.
- **typography:** familia Nunito; pesos 400/600/700/800/900; escala `h1: 34`,
  `body: 16`, `label: 13` (uppercase, tracking 1.5), `pill: 12`, `caption: 13.5`.
- **spacing:** 4/8/12/16/20/24/32/40.
- **radii:** `pill: 999`, `card: 18`, `button: 16`.

Reconstrucción idiomática en RN (View/Text, sombras con `shadow*`/`elevation`,
fuentes con expo-font). El HTML es referencia de valores y estructura, **no** código
a reutilizar.

## Mapeos de UI (`src/ui/deadline/`)

- **group-labels:** `NEEDS_ATTENTION -> "Requieren atención"`, `UPCOMING ->
  "Próximas"`, `CALM -> "Tranquilas"`.
- **urgency-colors:** `urgent -> rojo`, `upcoming -> ámbar`, `calm -> verde`. Devuelve
  `{ base, tintBg }`, usado en pastilla y tinte del icono.
- **type-icons** (MaterialCommunityIcons): `ITV->car`, `DNI->card-account-details`,
  `PASSPORT->passport`, `DRIVING_LICENSE->card-account-details-outline`,
  `INSURANCE->shield-check`, `SUBSCRIPTION->television-classic`,
  `WARRANTY->package-variant-closed`, `GAS_INSPECTION->fire`, `OTHER->dots-horizontal`.
  (Confirmar que cada nombre existe en el set instalado al implementar.)
- **format-time-remaining** `(days: number) => string`, umbrales en constantes
  (`DAYS_PER_MONTH`, `DAYS_PER_YEAR`, fácilmente ajustables):
  - `0 -> "hoy"`
  - `< 0 -> "vencido"`
  - `<= 60 -> "X días"` (singular "1 día")
  - `< 365 -> "X meses"` (redondeado; singular "1 mes")
  - `>= 365 -> "X año(s)"` (singular "1 año", plural "X años")

## Acceso al repo y flujo de datos

- **`RepositoryProvider`** (context). Prop `repository?: DeadlineRepository`.
  - Con prop: la usa directamente (camino de tests, ya lista).
  - Sin prop: en un efecto llama `createDeadlineRepository()`; mientras tanto
    renderiza `<Loading/>`. En `__DEV__`, tras crearla, llama
    `seedDeadlinesIfEmpty(repo)` antes de exponerla.
  - Expone `useDeadlineRepository(): DeadlineRepository`.
- **`useDeadlines()`**: toma el repo del context. En montaje hace `repo.list()` y
  expone estado `loading | error | ready`. En `ready` calcula
  `groupAndSort(list, today)` (memoizado). Expone `reload()` y mantiene `today` en
  estado para poder recalcularlo.
- **`HomeScreen`** (contenedor, `app/index.tsx`): usa `useDeadlines()` +
  `useRouter()`. `useFocusEffect` recalcula `today = new Date()` y dispara `reload()`
  al enfocar. `loading -> <Loading/>`; `error -> ` mensaje. Si el total de ítems
  activos es 0 -> `<EmptyState/>`; si no -> `<DeadlineList/>`. Navegación: fila ->
  `/deadline/[id]`, "+ Añadir" -> `/add`, botón del estado vacío -> `/add`.

## Pantalla (presentacional)

- **`EmptyState`** (ver `docs/design/Primer uso.png`): wordmark "nopasa";
  ilustración (calendario en círculo + check verde, documento y escudo flotantes con
  `@expo/vector-icons`); titular "Aquí no se te pasará nada"; frase de apoyo; botón
  "Añadir mi primer vencimiento"; línea de privacidad con candado "Se lee en tu
  móvil. Nada se sube a internet.".
- **`DeadlineList`** (ver `docs/design/Inicio.png`): `ScreenHeader` "Mis
  vencimientos"; resumen "{n} cosas requieren tu atención" (n = nº en
  NEEDS_ATTENTION); las tres secciones en orden (Requieren atención / Próximas /
  Tranquilas), **ocultando las vacías**, cada una con `SectionHeader` (etiqueta +
  contador). Cada `DeadlineRow`: icono tintado por urgencia, título, subtítulo,
  `Pill` (color de urgencia + `formatTimeRemaining`), y debajo importe + etiqueta si
  existe ("multa 200 €", "12,99 €/mes"). Botón fijo "+ Añadir" abajo.

### Nota (futura sesión, NO actuar ahora)

El estado vacío usa copy de primer uso ("tu primer vencimiento") y también se
mostraría a quien haya resuelto todos sus vencimientos. En esta sesión se deja tal
cual; en una sesión futura se distinguirá "primer uso" de "todo al día".

## Tests

Maximizar la lógica pura. Patrón TDD.

- **Puros (cobertura completa):**
  - `format-time-remaining`: hoy, vencido, días, meses, años y límites
    (−1, 0, 1, 60, 61, 364, 365, 366, 730) + casos singular.
  - `group-labels`: las 3 claves -> etiqueta esperada.
  - `urgency-colors`: los 3 niveles -> hex esperado.
- **Componentes (jest-expo + React Native Testing Library):**
  - `DeadlineList` con datos de ejemplo: aparecen las secciones correctas con sus
    contadores y las pastillas con el texto esperado; las secciones vacías no se
    renderizan.
  - `EmptyState`: aparecen el titular y el botón.
- **Integración del contenedor (OBLIGATORIO):**
  - `HomeScreen` envuelto en `RepositoryProvider` con `InMemoryDeadlineRepository`
    inyectado por la prop `repository`, poblado con vencimientos de ejemplo.
    Comprueba que la pantalla pasa de carga a lista poblada con sus secciones. Es el
    test que verifica el cableado de punta a punta: provider ->
    `useDeadlineRepository` -> `useDeadlines` -> `groupAndSort` -> lista.

`InMemoryDeadlineRepository` (`src/test-support/`) implementa el puerto completo en
memoria; reutilizable por futuras pantallas.

## Seed de desarrollo

`src/infrastructure/dev/seed-deadlines.ts`: `seedDeadlinesIfEmpty(repo)`, guardado por
`__DEV__`, idempotente (solo si `list()` está vacía). Inserta los ejemplos del diseño
(ITV — Clio, Seguro del coche, DNI — Marta, Netflix, Revisión de la caldera) para ver
la lista poblada al ejecutar. Marcado como temporal/eliminable.

## Calidad

- No cambiar el dominio ni la firma del puerto.
- La UI depende de la interfaz `DeadlineRepository`, no de la implementación.
- Componentes pequeños, con una responsabilidad clara y testeables por separado.
- Verificar versiones/APIs exactas de Expo 56 antes de escribir código.
```
