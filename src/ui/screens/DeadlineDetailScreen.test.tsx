import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { RepositoryProvider } from '../repository/repository-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { DeadlineDetailScreen } from './DeadlineDetailScreen';

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
});
