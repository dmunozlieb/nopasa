import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { SettingsProvider } from '../settings/settings-context';
import { SettingsScreen } from './SettingsScreen';

function renderScreen({
  repo = new InMemoryDeadlineRepository(),
  scheduler = new FakeNotificationScheduler(),
  settingsRepo = new InMemorySettingsRepository(),
  onClose = () => {},
}: {
  repo?: InMemoryDeadlineRepository;
  scheduler?: FakeNotificationScheduler;
  settingsRepo?: InMemorySettingsRepository;
  onClose?: () => void;
} = {}) {
  return render(
    <RepositoryProvider repository={repo}>
      <NotificationSchedulerProvider scheduler={scheduler}>
        <SettingsProvider repository={settingsRepo}>
          <SettingsScreen onClose={onClose} />
        </SettingsProvider>
      </NotificationSchedulerProvider>
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

  it('shows the app version and the inert "Próximamente" rows', async () => {
    await renderScreen({});
    expect(await screen.findByText(/Versión/)).toBeTruthy();
    expect(screen.getByText('Resumen semanal')).toBeTruthy();
    expect(screen.getAllByText('Próximamente').length).toBeGreaterThanOrEqual(3);
  });
});
