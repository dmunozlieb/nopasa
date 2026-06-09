import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// HomeScreen uses expo-router's useFocusEffect; stub it to run once on mount so the
// test needs only the RepositoryProvider, not a navigation container.
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(() => cb(), []);
  },
}));

import { buildDeadline } from '../../test-support/build-deadline';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { RepositoryProvider } from '../repository/repository-context';
import { HomeScreen } from './HomeScreen';

function at(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe('HomeScreen (integration)', () => {
  it('loads from the injected repository and renders the populated list', async () => {
    const repo = new InMemoryDeadlineRepository([
      buildDeadline({ id: '1', title: 'ITV — Clio', dueDate: at(4), amountLabel: 'multa 200 €' }),
      buildDeadline({ id: '2', title: 'Netflix', dueDate: at(14), amountLabel: '12,99 €/mes' }),
      buildDeadline({ id: '3', title: 'Pasaporte', dueDate: at(200) }),
    ]);

    await render(
      <RepositoryProvider repository={repo}>
        <HomeScreen onOpenDeadline={() => {}} onAdd={() => {}} onOpenSettings={() => {}} />
      </RepositoryProvider>,
    );

    await waitFor(() => expect(screen.getByText('Mis vencimientos')).toBeTruthy());
    expect(screen.getByText('1 cosa requiere tu atención')).toBeTruthy();
    expect(screen.getByText('REQUIEREN ATENCIÓN')).toBeTruthy();
    expect(screen.getByText('PRÓXIMAS')).toBeTruthy();
    expect(screen.getByText('TRANQUILAS')).toBeTruthy();
    expect(screen.getByText('ITV — Clio')).toBeTruthy();
  });

  it('shows the empty state when the repository is empty', async () => {
    await render(
      <RepositoryProvider repository={new InMemoryDeadlineRepository()}>
        <HomeScreen onOpenDeadline={() => {}} onAdd={() => {}} onOpenSettings={() => {}} />
      </RepositoryProvider>,
    );
    await waitFor(() => expect(screen.getByText('Aquí no se te pasará nada')).toBeTruthy());
  });

  it('shows an error then recovers on retry', async () => {
    // shouldFail controls whether list() throws. Both the hook's useEffect and the
    // useFocusEffect stub fire on mount, so we keep throwing until we deliberately
    // flip the flag right before the user presses Reintentar. That way the error
    // state is guaranteed to appear before recovery, making the test deterministic.
    let shouldFail = true;
    const flaky = {
      list: jest.fn(async () => {
        if (shouldFail) throw new Error('boom');
        return [];
      }),
      save: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    await render(
      <RepositoryProvider repository={flaky as any}>
        <HomeScreen onOpenDeadline={() => {}} onAdd={() => {}} onOpenSettings={() => {}} />
      </RepositoryProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('No se pudieron cargar tus vencimientos.')).toBeTruthy(),
    );
    expect(screen.getByText('Reintentar')).toBeTruthy();

    shouldFail = false;
    fireEvent.press(screen.getByText('Reintentar'));

    await waitFor(() =>
      expect(screen.getByText('Aquí no se te pasará nada')).toBeTruthy(),
    );
  });

  it('opens settings from the populated home header', async () => {
    const repo = new InMemoryDeadlineRepository([buildDeadline({ id: '1', title: 'ITV — Clio', dueDate: at(4) })]);
    const onOpenSettings = jest.fn();

    await render(
      <RepositoryProvider repository={repo}>
        <HomeScreen onOpenDeadline={() => {}} onAdd={() => {}} onOpenSettings={onOpenSettings} />
      </RepositoryProvider>,
    );

    fireEvent.press(await screen.findByLabelText('Ajustes'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
