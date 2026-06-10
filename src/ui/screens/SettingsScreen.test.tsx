import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { FakeDataExporter } from '../../test-support/fake-data-exporter';
import type { Clock } from '../../domain/deadline/deadline.factory';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { DataExporterProvider } from '../export/data-exporter-context';
import { SettingsProvider } from '../settings/settings-context';
import { SettingsScreen } from './SettingsScreen';

function renderScreen({
  repo = new InMemoryDeadlineRepository(),
  scheduler = new FakeNotificationScheduler(),
  settingsRepo = new InMemorySettingsRepository(),
  exporter = new FakeDataExporter(),
  clock = { now: () => new Date(2026, 5, 10) } as Clock,
  onClose = () => {},
  onOpenPrivacy = () => {},
}: {
  repo?: InMemoryDeadlineRepository;
  scheduler?: FakeNotificationScheduler;
  settingsRepo?: InMemorySettingsRepository;
  exporter?: FakeDataExporter;
  clock?: Clock;
  onClose?: () => void;
  onOpenPrivacy?: () => void;
} = {}) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider clock={clock}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <DataExporterProvider exporter={exporter}>
            <SettingsProvider repository={settingsRepo}>
              <SettingsScreen onClose={onClose} onOpenPrivacy={onOpenPrivacy} />
            </SettingsProvider>
          </DataExporterProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

describe('SettingsScreen', () => {
  it('persists a new reminder time', async () => {
    const settingsRepo = new InMemorySettingsRepository();
    await renderScreen({ settingsRepo });

    fireEvent.press(await screen.findByText('09:00'));
    fireEvent(await screen.findByTestId('datetimepicker'), 'change', { type: 'set' }, new Date(2026, 0, 1, 8, 30));

    await waitFor(async () => expect((await settingsRepo.load()).reminderTime).toEqual({ hour: 8, minute: 30 }));
  });

  it('persists changed default reminders', async () => {
    const settingsRepo = new InMemorySettingsRepository(); // default [30, 7]
    await renderScreen({ settingsRepo });

    fireEvent.press(await screen.findByText('1 día')); // add 1 → [30, 7, 1]

    await waitFor(async () => expect((await settingsRepo.load()).defaultReminderDaysBefore).toEqual([30, 7, 1]));
  });

  it('exports all deadlines to a dated file', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '1' }), buildDeadline({ id: '2' })]);
    const exporter = new FakeDataExporter();
    await renderScreen({ repo, exporter, clock: { now: () => new Date(2026, 5, 10) } as Clock });

    fireEvent.press(await screen.findByText('Exportar mis datos'));

    await waitFor(() => expect(exporter.calls).toHaveLength(1));
    expect(exporter.calls[0].filename).toBe('nopasa-export-2026-06-10.json');
    const parsed = JSON.parse(exporter.calls[0].content);
    expect(parsed.app).toBe('nopasa');
    expect(parsed.schema).toBe(1);
    expect(parsed.deadlines).toHaveLength(2);
  });

  it('does not export when there are no deadlines and shows a message', async () => {
    const exporter = new FakeDataExporter();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen({ repo: new InMemoryDeadlineRepository(), exporter });

    fireEvent.press(await screen.findByText('Exportar mis datos'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('No tienes vencimientos que exportar todavía'),
    );
    expect(exporter.calls).toHaveLength(0);
    alertSpy.mockRestore();
  });

  it('opens the privacy policy', async () => {
    const onOpenPrivacy = jest.fn();
    await renderScreen({ onOpenPrivacy });

    fireEvent.press(await screen.findByText('Política de privacidad'));

    expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  });

  it('deletes all deadlines (cancelling their reminders) after confirming', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '1' }), buildDeadline({ id: '2' })]);
    const scheduler = new FakeNotificationScheduler();
    const onClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderScreen({ repo, scheduler, onClose });

    fireEvent.press(await screen.findByText('Borrar todos los datos'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await repo.list()).toHaveLength(0);
    expect([...scheduler.cancelled].sort()).toEqual(['1', '2']);
    alertSpy.mockRestore();
  });

  it('renders the sections, the inert "Próximamente" rows and the version', async () => {
    await renderScreen({});
    expect(await screen.findByText('AVISOS')).toBeTruthy();
    expect(screen.getByText('APARIENCIA')).toBeTruthy();
    expect(screen.getByText('PRIVACIDAD Y DATOS')).toBeTruthy();
    expect(screen.getByText('Resumen semanal')).toBeTruthy();
    expect(screen.getByText('Tema')).toBeTruthy();
    expect(screen.getByText('Nopasa Premium')).toBeTruthy();
    expect(screen.getAllByText('Próximamente')).toHaveLength(3);
    expect(screen.getByText(/Versión/)).toBeTruthy();
  });
});
