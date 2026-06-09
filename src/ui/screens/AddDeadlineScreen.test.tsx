import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { AddDeadlineScreen } from './AddDeadlineScreen';

function renderScreen(repo: InMemoryDeadlineRepository, onClose: () => void = () => {}) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
          <AddDeadlineScreen onClose={onClose} />
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
});
