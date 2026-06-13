import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { FakePhotoStore } from '../../test-support/fake-photo-store';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { PhotoStoreProvider } from '../photo-store/photo-store-context';
import { SettingsProvider } from '../settings/settings-context';
import { AddDeadlineScreen } from './AddDeadlineScreen';

function renderScreen(
  repo: InMemoryDeadlineRepository,
  onClose: () => void = () => {},
  settingsRepo: InMemorySettingsRepository = new InMemorySettingsRepository(),
) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
          <PhotoStoreProvider store={new FakePhotoStore()}>
            <SettingsProvider repository={settingsRepo}>
              <AddDeadlineScreen onClose={onClose} />
            </SettingsProvider>
          </PhotoStoreProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

// Under this project's concurrent test renderer, each state-changing fireEvent
// schedules a deferred re-render. Awaiting a query (findBy*) after each one flushes
// that render before the next interaction, avoiding overlapping act() scopes.
describe('AddDeadlineScreen', () => {
  it('fills the form and saves: persists the deadline and closes (integration)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    const titleInput = await screen.findByPlaceholderText('Ej. ITV del coche');
    fireEvent.changeText(titleInput, 'Pasaporte de Ana');
    await screen.findByDisplayValue('Pasaporte de Ana');
    fireEvent.press(screen.getByText('Pasaporte'));
    await screen.findByDisplayValue('Documento para viajar fuera de la UE');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const saved = await repo.findById('fixed-id');
    expect(saved).toMatchObject({
      id: 'fixed-id',
      type: 'PASSPORT',
      title: 'Pasaporte de Ana',
      subtitle: 'Documento para viajar fuera de la UE',
      status: 'ACTIVE',
    });
    expect(saved?.dueDate).toEqual(new Date(2026, 5, 8));
    expect(saved?.createdAt).toEqual(new Date(2026, 5, 8));
    expect(saved?.reminderDaysBefore).toEqual([7, 30]);
  });

  it('does not save and shows a hint when the title is empty', async () => {
    const repo = new InMemoryDeadlineRepository();
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    // Touch the title field and leave it empty to reveal the hint.
    const title = await screen.findByPlaceholderText('Ej. ITV del coche');
    fireEvent.changeText(title, 'algo');
    await screen.findByDisplayValue('algo');
    fireEvent.changeText(title, '');

    expect(await screen.findByText('Ponle un nombre')).toBeTruthy();
    fireEvent.press(screen.getByText('Guardar')); // disabled → no-op
    expect(onClose).not.toHaveBeenCalled();
    expect(await repo.list()).toHaveLength(0);
  });

  it('keeps the form open and alerts when saving fails', async () => {
    const repo = new InMemoryDeadlineRepository();
    jest.spyOn(repo, 'save').mockRejectedValue(new Error('disk'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    const titleInput = await screen.findByPlaceholderText('Ej. ITV del coche');
    fireEvent.changeText(titleInput, 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('seeds the reminder chips from settings', async () => {
    const repo = new InMemoryDeadlineRepository();
    const settingsRepo = new InMemorySettingsRepository({ reminderTime: { hour: 9, minute: 0 }, defaultReminderDaysBefore: [7, 1] });
    await renderScreen(repo, () => {}, settingsRepo);

    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'Pasaporte de Ana');
    await screen.findByDisplayValue('Pasaporte de Ana');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(async () => {
      const saved = await repo.findById('fixed-id');
      expect(saved?.reminderDaysBefore).toEqual([1, 7]);
    });
  });

  it('shows the empty-plan hint for an unreachable date and still allows saving', async () => {
    const repo = new InMemoryDeadlineRepository();
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    const titleInput = await screen.findByPlaceholderText('Ej. ITV del coche');
    fireEvent.changeText(titleInput, 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');

    expect(screen.getByText(/tus avisos ya han pasado/)).toBeTruthy();

    // Non-blocking: saving still works despite the hint.
    fireEvent.press(screen.getByText('Guardar'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });

  it('persists the chosen recurrence preset (integration)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const onClose = jest.fn();
    await renderScreen(repo, onClose);

    const titleInput = await screen.findByPlaceholderText('Ej. ITV del coche');
    fireEvent.changeText(titleInput, 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Cada año'));
    await screen.findByText('Cada año');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('fixed-id'))?.recurrenceMonths).toBe(12);
  });

  it('hides the empty-plan hint when no reminders are selected', async () => {
    const repo = new InMemoryDeadlineRepository();
    await renderScreen(repo);
    await screen.findByPlaceholderText('Ej. ITV del coche');

    expect(screen.getByText(/tus avisos ya han pasado/)).toBeTruthy(); // default today + [30, 7]

    fireEvent.press(screen.getByText('30 días')); // deselect 30 → [7] (still all past)
    await screen.findByText(/tus avisos ya han pasado/);
    fireEvent.press(screen.getByText('7 días')); // deselect 7 → [] (no reminders)

    await waitFor(() => expect(screen.queryByText(/tus avisos ya han pasado/)).toBeNull());
  });
});
