import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { SettingsProvider } from '../settings/settings-context';
import { DeadlineDetailScreen } from './DeadlineDetailScreen';

function renderWith(
  repo: InMemoryDeadlineRepository,
  id: string,
  onClose: () => void = () => {},
  scheduler: FakeNotificationScheduler = new FakeNotificationScheduler(),
  now: Date = new Date(2026, 5, 13),
) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'x'} clock={{ now: () => now }}>
        <NotificationSchedulerProvider scheduler={scheduler}>
          <SettingsProvider repository={new InMemorySettingsRepository()}>
            <DeadlineDetailScreen id={id} onClose={onClose} />
          </SettingsProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

describe('DeadlineDetailScreen', () => {
  it('renders an ITV deadline: verb, consequence, actions, amount and manage label', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({
        id: '1',
        type: 'ITV',
        title: 'ITV — Clio',
        subtitle: 'Inspección técnica del coche',
        dueDate: new Date(2027, 5, 11),
        amount: 200,
        amountLabel: 'multa 200 €',
      }),
    ]);
    await renderWith(repo, '1');

    expect(await screen.findByText('ITV — Clio')).toBeTruthy();
    expect(screen.getByText(/^Caduca/)).toBeTruthy();
    expect(screen.getByText('La ITV en vigor es necesaria para circular con el coche.')).toBeTruthy();
    expect(screen.getByText('Reservar cita de ITV cerca')).toBeTruthy();
    expect(screen.getByText('Ver estaciones cercanas')).toBeTruthy();
    expect(screen.getByText('multa 200 €')).toBeTruthy();
    expect(screen.getByText('Marcar como renovado')).toBeTruthy();
  });

  it('renders a subscription: "Se cobra" and "Marcar como cancelada"', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '2', type: 'SUBSCRIPTION', title: 'Netflix', dueDate: new Date(2026, 5, 20) }),
    ]);
    await renderWith(repo, '2');

    expect(await screen.findByText('Netflix')).toBeTruthy();
    expect(screen.getByText(/^Se cobra/)).toBeTruthy();
    expect(screen.getByText('Marcar como cancelada')).toBeTruthy();
  });

  it('shows a not-found message when the id is absent', async () => {
    await renderWith(new InMemoryDeadlineRepository(), 'missing');
    expect(await screen.findByText('No encontramos este vencimiento.')).toBeTruthy();
  });

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

  it('shows the photo thumbnail when the deadline has a photoUri', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '9', type: 'ITV', title: 'ITV — Clio', photoUri: 'file:///document/photos/x.jpg' }),
    ]);
    await renderWith(repo, '9');
    expect(await screen.findByTestId('deadline-detail-photo')).toBeTruthy();
  });

  it('shows no thumbnail when there is no photoUri', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '10', type: 'ITV', title: 'ITV — Clio' })]);
    await renderWith(repo, '10');
    await screen.findByText('ITV — Clio');
    expect(screen.queryByTestId('deadline-detail-photo')).toBeNull();
  });

  it('a non-recurrent deadline keeps the standard manage row', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio' }),
    ]);
    await renderWith(repo, '1');
    expect(await screen.findByText('Marcar como renovado')).toBeTruthy();
    expect(screen.getByText('Posponer el aviso')).toBeTruthy();
    expect(screen.queryByText('Marcar como renovada')).toBeNull();
  });

  it('a recurrent deadline shows renew + stop-repeating + the recurrence indicator', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', recurrenceMonths: 12 }),
    ]);
    await renderWith(repo, '1');
    expect(await screen.findByText('Marcar como renovada')).toBeTruthy();
    expect(screen.getByText('Dejar de repetir')).toBeTruthy();
    expect(screen.getByText('Se repite cada año')).toBeTruthy();
    expect(screen.queryByText('Posponer el aviso')).toBeNull();
  });

  it('renews a recurrent deadline: advances the date, stays ACTIVE, reschedules and closes', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', dueDate: new Date(2026, 5, 8), recurrenceMonths: 12, reminderDaysBefore: [7], status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    const scheduler = new FakeNotificationScheduler();
    await renderWith(repo, '1', onClose, scheduler);

    fireEvent.press(await screen.findByText('Marcar como renovada'));
    fireEvent.press(await screen.findByText('Confirmar renovación'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const saved = await repo.findById('1');
    expect(saved?.dueDate).toEqual(new Date(2027, 5, 8)); // nextDueDate(2026-06-08, 12, 2026-06-13)
    expect(saved?.status).toBe('ACTIVE');
    expect(saved?.recurrenceMonths).toBe(12); // stays recurrent so it can renew again next cycle
    expect(scheduler.cancelled).toEqual(['1']);
    expect(scheduler.scheduled.has('1')).toBe(true);
  });

  it('stops repeating after confirming the destructive dialog', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', recurrenceMonths: 12, status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    const scheduler = new FakeNotificationScheduler();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderWith(repo, '1', onClose, scheduler);

    fireEvent.press(await screen.findByText('Dejar de repetir'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('1'))?.status).toBe('RESOLVED');
    expect(scheduler.cancelled).toEqual(['1']);
    alertSpy.mockRestore();
  });

  it('does nothing when the stop-repeating dialog is cancelled', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', type: 'ITV', title: 'ITV — Clio', recurrenceMonths: 12, status: 'ACTIVE' }),
    ]);
    const onClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    await renderWith(repo, '1', onClose);

    fireEvent.press(await screen.findByText('Dejar de repetir'));

    expect(onClose).not.toHaveBeenCalled();
    expect((await repo.findById('1'))?.status).toBe('ACTIVE');
    alertSpy.mockRestore();
  });
});
