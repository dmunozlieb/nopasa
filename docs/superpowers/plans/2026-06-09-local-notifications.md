# Local notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schedule local reminders when a deadline is created and cancel them when it is marked resolved/cancelled, with `expo-notifications` confined behind a port.

**Architecture:** A pure planner `buildNotificationPlan` turns a deadline + `{ now, reminderTime }` into a list of fully-resolved `{ fireAt, title, body }`. The create hook computes the plan and hands it to a `NotificationScheduler` port (a thin effects executor). A real adapter wraps `expo-notifications`; a fake records calls. Scheduling/cancelling are best-effort and never break save/mark. DST-safety lives in the planner's local-component date math.

**Tech Stack:** Expo SDK 56, React Native 0.85, `expo-notifications`, Zod 4, Jest + @testing-library/react-native.

---

## File structure

Created:
- `src/ports/notification-scheduler.ts` — `PlannedNotification` type + `NotificationScheduler` interface.
- `src/ui/notification/reminder-time.ts` — `ReminderTime` type + `DEFAULT_REMINDER_TIME` (09:00).
- `src/ui/notification/build-notification-content.ts` — pure `buildNotificationContent`.
- `src/ui/notification/build-notification-plan.ts` — pure `buildNotificationPlan`.
- `src/infrastructure/notifications/expo-notification-scheduler.ts` — the adapter.
- `src/test-support/fake-notification-scheduler.ts` — the fake.
- `src/ui/notification-scheduler/notification-scheduler-context.tsx` — provider + hook.
- Test files alongside each unit.

Modified:
- `jest.setup.js` — mock `expo-notifications`.
- `package.json` / `app.json` — add `expo-notifications` (via `expo install`).
- `src/ui/deadline/format-date.ts` — add `formatShortDate`.
- `src/ui/hooks/use-create-deadline.ts` (+ test) — schedule after save.
- `src/ui/screens/DeadlineDetailScreen.tsx` (+ test) — cancel in `markAs`.
- `app/_layout.tsx` — mount `NotificationSchedulerProvider`.

Notes for the implementer:
- Tests run only under `src/` (jest `roots`) with `TZ=Europe/Madrid`. Run all with `npm test`; one file with `npm test -- <path>`.
- **RNTL in this repo is async/concurrent:** `await render(...)` and `await renderHook(...)`; make the first query after a render an awaited `findBy*`; await a `findBy*` after each state-changing `fireEvent` before the next interaction. (Not relevant to the pure tests here, but applies to the hook/screen tests.)
- Code/identifiers/comments in English; commit messages in English; no `Co-Authored-By` trailers.

---

### Task 1: Install expo-notifications + jest mock

**Files:**
- Modify: `package.json` / `app.json` (via `expo install`)
- Modify: `jest.setup.js`

- [ ] **Step 1: Install the package (Expo-managed version)**

Run: `npx expo install expo-notifications`
Expected: adds `expo-notifications` to `package.json` (an SDK-56-compatible version); may add a config plugin to `app.json`.

- [ ] **Step 2: Add a jest mock so modules importing expo-notifications load under jsdom**

Append to `jest.setup.js`:

```js
// Mock expo-notifications: the native module can't load under jsdom. Defaults are
// inert-but-functional (permission granted, no scheduled items) so the adapter is
// importable; the adapter's own test overrides return values per case.
jest.mock('expo-notifications', () => ({
  __esModule: true,
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setNotificationChannelAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'mock-id'),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}));
```

- [ ] **Step 3: Verify the suite still loads**

Run: `npm test`
Expected: PASS — existing 141 tests still green (the new mock is inert until used).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.json jest.setup.js
git commit -m "build(notifications): install expo-notifications and mock it in jest"
```

(If `expo install` did not modify `app.json`, omit it from the `git add`.)

---

### Task 2: `NotificationScheduler` port

**Files:**
- Create: `src/ports/notification-scheduler.ts`

The port is an interface + contract type; like `src/ports/deadline-repository.ts` it has no unit test and is verified by typecheck.

- [ ] **Step 1: Write the port**

```ts
/** A single resolved local notification: when to fire and what to show. */
export interface PlannedNotification {
  fireAt: Date;
  title: string;
  body: string;
}

/**
 * Effects port for local notifications. The UI depends on this, never on
 * expo-notifications directly. Implementations execute a pre-computed plan;
 * planning is pure app logic that lives elsewhere.
 */
export interface NotificationScheduler {
  /** Schedule every notification in `plan`, tagged so it can be cancelled later by id. */
  schedule(deadlineId: string, plan: PlannedNotification[]): Promise<void>;
  /** Cancel all pending notifications previously scheduled for `deadlineId`. */
  cancel(deadlineId: string): Promise<void>;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ports/notification-scheduler.ts
git commit -m "feat(notifications): NotificationScheduler port and PlannedNotification type"
```

---

### Task 3: `formatShortDate` (pure)

**Files:**
- Modify: `src/ui/deadline/format-date.ts`
- Test: `src/ui/deadline/format-date.test.ts` (existing — add cases)

- [ ] **Step 1: Add the failing test**

Append inside the existing `src/ui/deadline/format-date.test.ts` (add the import for `formatShortDate` to the existing import line):

```ts
describe('formatShortDate', () => {
  it('formats a Spanish short date without the year', () => {
    expect(formatShortDate(new Date(2026, 5, 11))).toBe('11 jun');
    expect(formatShortDate(new Date(2026, 6, 4))).toBe('4 jul');
    expect(formatShortDate(new Date(2026, 8, 1))).toBe('1 sep');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/deadline/format-date.test.ts`
Expected: FAIL — `formatShortDate` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/ui/deadline/format-date.ts`:

```ts
/** Spanish short date without the year, e.g. "11 jun". Reuses the month names above. */
export function formatShortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/deadline/format-date.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/deadline/format-date.ts src/ui/deadline/format-date.test.ts
git commit -m "feat(notifications): formatShortDate (no year) for reminder copy"
```

---

### Task 4: `reminder-time` constant

**Files:**
- Create: `src/ui/notification/reminder-time.ts`

A type + constant; no dedicated test (verified by typecheck and used by later tasks).

- [ ] **Step 1: Write the file**

```ts
/** Local wall-clock time at which reminders fire. */
export interface ReminderTime {
  hour: number;
  minute: number;
}

/** Default fire time until a settings screen exists: 09:00 local. */
export const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 9, minute: 0 };
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/notification/reminder-time.ts
git commit -m "feat(notifications): ReminderTime type and 09:00 default"
```

---

### Task 5: `buildNotificationContent` (pure)

**Files:**
- Create: `src/ui/notification/build-notification-content.ts`
- Test: `src/ui/notification/build-notification-content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildDeadline } from '../../test-support/build-deadline';
import { buildNotificationContent } from './build-notification-content';

describe('buildNotificationContent', () => {
  it('uses the per-type verb, the countdown and a short date (plural)', () => {
    const d = buildDeadline({ type: 'ITV', title: 'ITV del coche', dueDate: new Date(2026, 5, 11) });
    expect(buildNotificationContent(d, 7)).toEqual({
      title: 'ITV del coche',
      body: 'Caduca en 7 días · 11 jun',
    });
  });

  it('uses the singular "día" for one day and the subscription verb', () => {
    const d = buildDeadline({ type: 'SUBSCRIPTION', title: 'Netflix', dueDate: new Date(2026, 5, 12) });
    expect(buildNotificationContent(d, 1)).toEqual({
      title: 'Netflix',
      body: 'Se cobra en 1 día · 12 jun',
    });
  });

  it('says "hoy" when daysBefore is 0', () => {
    const d = buildDeadline({ type: 'GAS_INSPECTION', title: 'Revisión gas', dueDate: new Date(2026, 6, 4) });
    expect(buildNotificationContent(d, 0)).toEqual({
      title: 'Revisión gas',
      body: 'Vence hoy · 4 jul',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/notification/build-notification-content.test.ts`
Expected: FAIL — cannot find module `./build-notification-content`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { detailPresentation } from '../deadline/detail-presentation';
import { formatShortDate } from '../deadline/format-date';

/** Pure: the title/body for a reminder. Calm tone, reusing the per-type verb from the
 *  detail screen. Countdown is "hoy" for 0, "en 1 día" / "en N días" otherwise. */
export function buildNotificationContent(
  deadline: Deadline,
  daysBefore: number,
): { title: string; body: string } {
  const verb = detailPresentation(deadline.type).verb;
  const countdown =
    daysBefore === 0 ? 'hoy' : `en ${daysBefore} ${daysBefore === 1 ? 'día' : 'días'}`;
  return {
    title: deadline.title,
    body: `${verb} ${countdown} · ${formatShortDate(deadline.dueDate)}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/notification/build-notification-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/notification/build-notification-content.ts src/ui/notification/build-notification-content.test.ts
git commit -m "feat(notifications): per-type reminder copy (verb + countdown + short date)"
```

---

### Task 6: `buildNotificationPlan` (pure, DST-safe)

**Files:**
- Create: `src/ui/notification/build-notification-plan.ts`
- Test: `src/ui/notification/build-notification-plan.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildDeadline } from '../../test-support/build-deadline';
import { buildNotificationPlan } from './build-notification-plan';
import { DEFAULT_REMINDER_TIME } from './reminder-time';

const reminderTime = DEFAULT_REMINDER_TIME;

describe('buildNotificationPlan', () => {
  it('produces one notification per reminder, at the reminder time, preserving order', () => {
    const deadline = buildDeadline({ dueDate: new Date(2026, 8, 1), reminderDaysBefore: [7, 30] });
    const plan = buildNotificationPlan(deadline, { now: new Date(2026, 5, 8), reminderTime });
    expect(plan.map((p) => p.fireAt)).toEqual([
      new Date(2026, 7, 25, 9, 0),
      new Date(2026, 7, 2, 9, 0),
    ]);
  });

  it('builds fireAt from local components (DST-safe across Madrid autumn change)', () => {
    // Madrid falls back on 25 Oct 2026 (a 25-hour day). Due 26 Oct, 7 days before = 19 Oct.
    // Naive `dueDate.getTime() - N*86400000` would drift to 08:00; component math stays 09:00.
    const deadline = buildDeadline({ dueDate: new Date(2026, 9, 26), reminderDaysBefore: [7] });
    const [item] = buildNotificationPlan(deadline, { now: new Date(2026, 0, 1), reminderTime });
    expect(item.fireAt.getFullYear()).toBe(2026);
    expect(item.fireAt.getMonth()).toBe(9);
    expect(item.fireAt.getDate()).toBe(19);
    expect(item.fireAt.getHours()).toBe(9);
    expect(item.fireAt.getMinutes()).toBe(0);
  });

  it('omits reminders whose fire time is already in the past', () => {
    const deadline = buildDeadline({ dueDate: new Date(2026, 5, 20), reminderDaysBefore: [30, 7] });
    // 30-before = 21 May 09:00 (past); 7-before = 13 Jun 09:00 (future).
    const plan = buildNotificationPlan(deadline, { now: new Date(2026, 5, 1, 9, 30), reminderTime });
    expect(plan).toHaveLength(1);
    expect(plan[0].fireAt).toEqual(new Date(2026, 5, 13, 9, 0));
  });

  it('returns an empty plan when all fire times are past or there are no reminders', () => {
    const past = buildDeadline({ dueDate: new Date(2026, 5, 3), reminderDaysBefore: [30, 7] });
    expect(buildNotificationPlan(past, { now: new Date(2026, 5, 2), reminderTime })).toEqual([]);
    const none = buildDeadline({ dueDate: new Date(2026, 8, 1), reminderDaysBefore: [] });
    expect(buildNotificationPlan(none, { now: new Date(2026, 5, 8), reminderTime })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/notification/build-notification-plan.test.ts`
Expected: FAIL — cannot find module `./build-notification-plan`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Deadline } from '../../domain/deadline/deadline.schema';
import type { PlannedNotification } from '../../ports/notification-scheduler';
import { buildNotificationContent } from './build-notification-content';
import type { ReminderTime } from './reminder-time';

export interface BuildPlanOptions {
  now: Date;
  reminderTime: ReminderTime;
}

/** Pure: resolves each reminderDaysBefore into a fully-formed notification, dropping
 *  any whose fire time is already at/before `now`. fireAt is built from the due date's
 *  LOCAL components + the wall-clock time (no millisecond arithmetic), so DST shifts
 *  between now and the due date never skew it — same spirit as the domain's daysBetween. */
export function buildNotificationPlan(
  deadline: Deadline,
  options: BuildPlanOptions,
): PlannedNotification[] {
  const plan: PlannedNotification[] = [];
  for (const daysBefore of deadline.reminderDaysBefore) {
    const fireAt = new Date(
      deadline.dueDate.getFullYear(),
      deadline.dueDate.getMonth(),
      deadline.dueDate.getDate() - daysBefore,
      options.reminderTime.hour,
      options.reminderTime.minute,
    );
    if (fireAt.getTime() <= options.now.getTime()) continue;
    plan.push({ fireAt, ...buildNotificationContent(deadline, daysBefore) });
  }
  return plan;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/notification/build-notification-plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/notification/build-notification-plan.ts src/ui/notification/build-notification-plan.test.ts
git commit -m "feat(notifications): DST-safe reminder planner"
```

---

### Task 7: `FakeNotificationScheduler` (test-support)

**Files:**
- Create: `src/test-support/fake-notification-scheduler.ts`
- Test: `src/test-support/fake-notification-scheduler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { FakeNotificationScheduler } from './fake-notification-scheduler';
import type { PlannedNotification } from '../ports/notification-scheduler';

const plan: PlannedNotification[] = [
  { fireAt: new Date(2026, 7, 25, 9, 0), title: 'ITV del coche', body: 'Caduca en 7 días · 1 sep' },
];

describe('FakeNotificationScheduler', () => {
  it('records a scheduled plan by deadline id', async () => {
    const fake = new FakeNotificationScheduler();
    await fake.schedule('d1', plan);
    expect(fake.scheduled.get('d1')).toEqual(plan);
  });

  it('records cancellations and drops the scheduled plan', async () => {
    const fake = new FakeNotificationScheduler();
    await fake.schedule('d1', plan);
    await fake.cancel('d1');
    expect(fake.cancelled).toEqual(['d1']);
    expect(fake.scheduled.has('d1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test-support/fake-notification-scheduler.test.ts`
Expected: FAIL — cannot find module `./fake-notification-scheduler`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { NotificationScheduler, PlannedNotification } from '../ports/notification-scheduler';

/** In-memory NotificationScheduler for tests. Records schedule/cancel calls. */
export class FakeNotificationScheduler implements NotificationScheduler {
  readonly scheduled = new Map<string, PlannedNotification[]>();
  readonly cancelled: string[] = [];

  async schedule(deadlineId: string, plan: PlannedNotification[]): Promise<void> {
    this.scheduled.set(deadlineId, plan);
  }

  async cancel(deadlineId: string): Promise<void> {
    this.cancelled.push(deadlineId);
    this.scheduled.delete(deadlineId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test-support/fake-notification-scheduler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test-support/fake-notification-scheduler.ts src/test-support/fake-notification-scheduler.test.ts
git commit -m "test(notifications): in-memory FakeNotificationScheduler"
```

---

### Task 8: `expoNotificationScheduler` adapter

**Files:**
- Create: `src/infrastructure/notifications/expo-notification-scheduler.ts`
- Test: `src/infrastructure/notifications/expo-notification-scheduler.test.ts`

- [ ] **Step 1: Write the failing test**

The global `expo-notifications` mock (Task 1) provides the `jest.fn()`s; each test sets return values as needed.

```ts
import * as Notifications from 'expo-notifications';
import { expoNotificationScheduler } from './expo-notification-scheduler';
import type { PlannedNotification } from '../../ports/notification-scheduler';

const plan: PlannedNotification[] = [
  { fireAt: new Date(2026, 7, 25, 9, 0), title: 'ITV del coche', body: 'Caduca en 7 días · 1 sep' },
  { fireAt: new Date(2026, 7, 2, 9, 0), title: 'ITV del coche', body: 'Caduca en 30 días · 1 sep' },
];

describe('expoNotificationScheduler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing for an empty plan (no permission prompt)', async () => {
    await expoNotificationScheduler.schedule('d1', []);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules one tagged notification per plan item when permission is granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    await expoNotificationScheduler.schedule('d1', plan);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'ITV del coche', body: 'Caduca en 7 días · 1 sep', data: { deadlineId: 'd1' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(2026, 7, 25, 9, 0) },
    });
  });

  it('requests permission when undetermined and schedules nothing if denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await expoNotificationScheduler.schedule('d1', plan);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels only the notifications tagged with the given deadline id', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'a', content: { data: { deadlineId: 'd1' } } },
      { identifier: 'b', content: { data: { deadlineId: 'd2' } } },
      { identifier: 'c', content: { data: { deadlineId: 'd1' } } },
    ]);
    await expoNotificationScheduler.cancel('d1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('a');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('c');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/infrastructure/notifications/expo-notification-scheduler.test.ts`
Expected: FAIL — cannot find module `./expo-notification-scheduler`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NotificationScheduler, PlannedNotification } from '../../ports/notification-scheduler';

const ANDROID_CHANNEL_ID = 'reminders';

/** Asks for notification permission only when needed. Returns whether it is granted. */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Thin adapter over expo-notifications. Confined to infrastructure; mocked in tests. */
export const expoNotificationScheduler: NotificationScheduler = {
  async schedule(deadlineId: string, plan: PlannedNotification[]): Promise<void> {
    if (plan.length === 0) return; // nothing to schedule → no permission prompt
    if (!(await ensurePermission())) return; // best-effort: denied → schedule nothing
    if (Platform.OS === 'android') {
      // Android silently drops scheduled notifications without a channel.
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Avisos de vencimientos',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    for (const item of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: item.title, body: item.body, data: { deadlineId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.fireAt },
      });
    }
  },

  async cancel(deadlineId: string): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.content?.data?.deadlineId === deadlineId) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/infrastructure/notifications/expo-notification-scheduler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/notifications/expo-notification-scheduler.ts src/infrastructure/notifications/expo-notification-scheduler.test.ts
git commit -m "feat(notifications): expo-notifications adapter (schedule/cancel by tag)"
```

---

### Task 9: `NotificationSchedulerProvider` + `useNotificationScheduler`

**Files:**
- Create: `src/ui/notification-scheduler/notification-scheduler-context.tsx`
- Test: `src/ui/notification-scheduler/notification-scheduler-context.test.tsx`

- [ ] **Step 1: Write the failing test**

Note: `renderHook` is async in this repo — await it; the no-provider case rejects.

```tsx
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import {
  NotificationSchedulerProvider,
  useNotificationScheduler,
} from './notification-scheduler-context';

describe('useNotificationScheduler', () => {
  it('returns the injected scheduler', async () => {
    const scheduler = new FakeNotificationScheduler();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotificationSchedulerProvider scheduler={scheduler}>{children}</NotificationSchedulerProvider>
    );
    const { result } = await renderHook(() => useNotificationScheduler(), { wrapper });
    expect(result.current).toBe(scheduler);
  });

  it('falls back to the production default when none is injected', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotificationSchedulerProvider>{children}</NotificationSchedulerProvider>
    );
    const { result } = await renderHook(() => useNotificationScheduler(), { wrapper });
    expect(typeof result.current.schedule).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  it('throws when used outside the provider', async () => {
    await expect(renderHook(() => useNotificationScheduler())).rejects.toThrow(
      'useNotificationScheduler must be used within a NotificationSchedulerProvider',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/notification-scheduler/notification-scheduler-context.test.tsx`
Expected: FAIL — cannot find module `./notification-scheduler-context`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { NotificationScheduler } from '../../ports/notification-scheduler';
import { expoNotificationScheduler } from '../../infrastructure/notifications/expo-notification-scheduler';

const NotificationSchedulerContext = createContext<NotificationScheduler | null>(null);

interface NotificationSchedulerProviderProps {
  /** Inject a fake (tests). Omit for the production expo-notifications adapter. */
  scheduler?: NotificationScheduler;
  children: ReactNode;
}

export function NotificationSchedulerProvider({
  scheduler,
  children,
}: NotificationSchedulerProviderProps) {
  return (
    <NotificationSchedulerContext.Provider value={scheduler ?? expoNotificationScheduler}>
      {children}
    </NotificationSchedulerContext.Provider>
  );
}

export function useNotificationScheduler(): NotificationScheduler {
  const scheduler = useContext(NotificationSchedulerContext);
  if (!scheduler) {
    throw new Error('useNotificationScheduler must be used within a NotificationSchedulerProvider');
  }
  return scheduler;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/notification-scheduler/notification-scheduler-context.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/notification-scheduler/notification-scheduler-context.tsx src/ui/notification-scheduler/notification-scheduler-context.test.tsx
git commit -m "feat(notifications): NotificationSchedulerProvider DI"
```

---

### Task 10: Schedule on create (`useCreateDeadline`)

**Files:**
- Modify: `src/ui/hooks/use-create-deadline.ts`
- Test: `src/ui/hooks/use-create-deadline.test.tsx` (full replace)

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `src/ui/hooks/use-create-deadline.test.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import type { NotificationScheduler } from '../../ports/notification-scheduler';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { useCreateDeadline } from './use-create-deadline';

function wrapperWith(repo: InMemoryDeadlineRepository, scheduler: NotificationScheduler) {
  return ({ children }: { children: ReactNode }) => (
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={scheduler}>{children}</NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>
  );
}

const input = {
  type: 'ITV' as const,
  title: 'ITV del coche',
  dueDate: new Date(2026, 8, 1),
  reminderDaysBefore: [7, 30],
};

describe('useCreateDeadline', () => {
  it('builds a Deadline with injected id/clock and persists it', async () => {
    const repo = new InMemoryDeadlineRepository();
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, new FakeNotificationScheduler()),
    });

    const created = await result.current(input);

    expect(created.id).toBe('fixed-id');
    expect(created.createdAt).toEqual(new Date(2026, 5, 8));
    expect(created.status).toBe('ACTIVE');
    expect(await repo.findById('fixed-id')).toMatchObject({ id: 'fixed-id', title: 'ITV del coche' });
  });

  it('schedules the reminder plan for the new deadline', async () => {
    const repo = new InMemoryDeadlineRepository();
    const scheduler = new FakeNotificationScheduler();
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, scheduler),
    });

    await result.current(input);

    expect(scheduler.scheduled.get('fixed-id')).toEqual([
      { fireAt: new Date(2026, 7, 25, 9, 0), title: 'ITV del coche', body: 'Caduca en 7 días · 1 sep' },
      { fireAt: new Date(2026, 7, 2, 9, 0), title: 'ITV del coche', body: 'Caduca en 30 días · 1 sep' },
    ]);
  });

  it('persists even when scheduling throws (best-effort)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const throwing: NotificationScheduler = {
      schedule: async () => {
        throw new Error('scheduler down');
      },
      cancel: async () => {},
    };
    const { result } = await renderHook(() => useCreateDeadline(), {
      wrapper: wrapperWith(repo, throwing),
    });

    const created = await result.current(input);

    expect(created.id).toBe('fixed-id');
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/hooks/use-create-deadline.test.tsx`
Expected: FAIL — the new scheduling test fails (no plan recorded) and/or the hook does not yet read the scheduler provider.

- [ ] **Step 3: Update the implementation**

Replace the entire contents of `src/ui/hooks/use-create-deadline.ts` with:

```ts
import { useCallback } from 'react';
import { createDeadline, type CreateDeadlineInput } from '../../domain/deadline/deadline.factory';
import type { Deadline } from '../../domain/deadline/deadline.schema';
import { useDeadlineRepository } from '../repository/repository-context';
import { useDeadlineDeps } from '../deadline-deps/deadline-deps-context';
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
import { buildNotificationPlan } from '../notification/build-notification-plan';
import { DEFAULT_REMINDER_TIME } from '../notification/reminder-time';

/** Returns a function that builds a Deadline via the domain factory (id/clock from DI),
 *  persists it, and then schedules its reminders. Scheduling is best-effort: a scheduler
 *  failure never fails the save. */
export function useCreateDeadline(): (input: CreateDeadlineInput) => Promise<Deadline> {
  const repository = useDeadlineRepository();
  const deps = useDeadlineDeps();
  const scheduler = useNotificationScheduler();
  return useCallback(
    async (input: CreateDeadlineInput) => {
      const deadline = createDeadline(input, deps);
      await repository.save(deadline);
      try {
        const plan = buildNotificationPlan(deadline, {
          now: deps.clock.now(),
          reminderTime: DEFAULT_REMINDER_TIME,
        });
        await scheduler.schedule(deadline.id, plan);
      } catch {
        // Notifications are best-effort; never fail the save because of them.
      }
      return deadline;
    },
    [repository, deps, scheduler],
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/hooks/use-create-deadline.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/use-create-deadline.ts src/ui/hooks/use-create-deadline.test.tsx
git commit -m "feat(notifications): schedule reminders on deadline create (best-effort)"
```

---

### Task 11: Cancel on mark resolved/cancelled (`DeadlineDetailScreen`)

**Files:**
- Modify: `src/ui/screens/DeadlineDetailScreen.tsx`
- Test: `src/ui/screens/DeadlineDetailScreen.test.tsx`

- [ ] **Step 1: Update the test**

In `src/ui/screens/DeadlineDetailScreen.test.tsx`, add these imports near the top (after the existing imports):

```tsx
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
```

Replace the existing `renderWith` helper with:

```tsx
function renderWith(
  repo: InMemoryDeadlineRepository,
  id: string,
  onClose: () => void = () => {},
  scheduler: FakeNotificationScheduler = new FakeNotificationScheduler(),
) {
  return render(
    <RepositoryProvider repository={repo}>
      <NotificationSchedulerProvider scheduler={scheduler}>
        <DeadlineDetailScreen id={id} onClose={onClose} />
      </NotificationSchedulerProvider>
    </RepositoryProvider>,
  );
}
```

Replace the `'marks as resolved...'` test with:

```tsx
  it('marks as resolved: updates the repository status, cancels reminders and closes', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    const scheduler = new FakeNotificationScheduler();
    await renderWith(repo, '1', onClose, scheduler);

    fireEvent.press(await screen.findByText('Marcar como renovado'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('1'))?.status).toBe('RESOLVED');
    expect(scheduler.cancelled).toEqual(['1']);
  });
```

Replace the `'marks a subscription as cancelled'` test with:

```tsx
  it('marks a subscription as cancelled and cancels its reminders', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '2', type: 'SUBSCRIPTION', title: 'Netflix', status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    const scheduler = new FakeNotificationScheduler();
    await renderWith(repo, '2', onClose, scheduler);

    fireEvent.press(await screen.findByText('Marcar como cancelada'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('2'))?.status).toBe('CANCELLED');
    expect(scheduler.cancelled).toEqual(['2']);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/DeadlineDetailScreen.test.tsx`
Expected: FAIL — `scheduler.cancelled` is empty (cancel not wired) — or the component throws because `useNotificationScheduler` has no provider until the impl reads it (the wrapper already provides it; the failing assertion is the `cancelled` check).

- [ ] **Step 3: Update the implementation**

In `src/ui/screens/DeadlineDetailScreen.tsx`, add the import (next to the other hook imports):

```tsx
import { useNotificationScheduler } from '../notification-scheduler/notification-scheduler-context';
```

Add the hook call alongside the existing ones (before the early returns), i.e. just after `const repo = useDeadlineRepository();`:

```tsx
  const scheduler = useNotificationScheduler();
```

Replace the `markAs` function with:

```tsx
  const markAs = async () => {
    await repo.update({ ...deadline, status: presentation.manage.targetStatus });
    try {
      await scheduler.cancel(deadline.id);
    } catch {
      // Cancellation is best-effort; closing should not depend on it.
    }
    onClose();
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/DeadlineDetailScreen.test.tsx`
Expected: PASS (all five cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/DeadlineDetailScreen.tsx src/ui/screens/DeadlineDetailScreen.test.tsx
git commit -m "feat(notifications): cancel reminders when marking resolved/cancelled"
```

---

### Task 12: Mount the provider

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add the import**

In `app/_layout.tsx`, add next to the other provider imports:

```tsx
import { NotificationSchedulerProvider } from '../src/ui/notification-scheduler/notification-scheduler-context';
```

- [ ] **Step 2: Nest the provider inside DeadlineDepsProvider**

Replace the provider/Stack block with:

```tsx
    <SafeAreaProvider>
      <RepositoryProvider>
        <DeadlineDepsProvider>
          <NotificationSchedulerProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="deadline/[id]" options={{ presentation: 'modal' }} />
            </Stack>
          </NotificationSchedulerProvider>
        </DeadlineDepsProvider>
      </RepositoryProvider>
    </SafeAreaProvider>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(notifications): mount NotificationSchedulerProvider"
```

---

### Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all previous tests plus the new ones green, no `act()` warnings.

- [ ] **Step 2: Typecheck the project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit (only if anything was adjusted during verification)**

```bash
git add -A
git commit -m "chore(notifications): finalize local reminder scheduling"
```

---

## Self-review notes

- **Spec coverage:** port (Task 2), pure planner + DST case (Task 6), per-type copy (Task 5), short date (Task 3), reminder-time constant (Task 4), adapter with permission/channel/tagged-cancel (Task 8), fake (Task 7), DI provider (Task 9), schedule-on-create best-effort (Task 10), cancel-on-mark (Task 11), provider wiring (Task 12), install + mock (Task 1). The "known gap" (silent empty plan) is intentionally not implemented. All spec sections map to a task.
- **Type consistency:** `PlannedNotification { fireAt, title, body }` defined in Task 2 is produced by `buildNotificationContent`+`buildNotificationPlan` (Tasks 5–6) and consumed by the adapter/fake (Tasks 7–8) and asserted in Tasks 10–11. `NotificationScheduler.schedule(deadlineId, plan)` / `cancel(deadlineId)` signatures match across port, fake, adapter, hook and screen. `ReminderTime { hour, minute }` (Task 4) is consumed by the planner (Task 6) and the default is used by the hook (Task 10).
- **Best-effort:** both integration points wrap the scheduler call in try/catch (Tasks 10–11); Task 10 proves a throwing scheduler does not block save.
- **No schema change:** cancellation is by `content.data.deadlineId` query (Task 8), not persisted IDs.
- **Out of scope honored:** no settings screen (time is a constant), no edit/reschedule, no digest, no "posponer", no launch-reschedule, no iOS-specific work, no photo/OCR.
