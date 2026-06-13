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
import { DeadlineForm } from './DeadlineForm';

function renderForm(opts: {
  repo: InMemoryDeadlineRepository;
  photoStore?: FakePhotoStore;
  photoUri?: string;
  onSaved?: () => void;
}) {
  const photoStore = opts.photoStore ?? new FakePhotoStore();
  return render(
    <RepositoryProvider repository={opts.repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
          <PhotoStoreProvider store={photoStore}>
            <SettingsProvider repository={new InMemorySettingsRepository()}>
              <DeadlineForm heading="Confirma los datos" photoUri={opts.photoUri} onSaved={opts.onSaved ?? (() => {})} />
            </SettingsProvider>
          </PhotoStoreProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

describe('DeadlineForm', () => {
  it('renders the heading and a thumbnail when photoUri is set', async () => {
    await renderForm({ repo: new InMemoryDeadlineRepository(), photoUri: 'file:///cache/cam.jpg' });
    expect(screen.getByText('Confirma los datos')).toBeTruthy();
    expect(screen.getByTestId('deadline-photo-thumbnail')).toBeTruthy();
  });

  it('persists the photo on save and stores the STABLE uri, then closes', async () => {
    const repo = new InMemoryDeadlineRepository();
    const photoStore = new FakePhotoStore();
    const onSaved = jest.fn();
    await renderForm({ repo, photoStore, photoUri: 'file:///cache/cam.jpg', onSaved });

    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(photoStore.persisted).toEqual(['file:///cache/cam.jpg']);
    const saved = await repo.findById('fixed-id');
    expect(saved?.photoUri).toBe('stable:///0.jpg');
  });

  it('does not persist or set photoUri on a manual save (no photoUri)', async () => {
    const repo = new InMemoryDeadlineRepository();
    const photoStore = new FakePhotoStore();
    await renderForm({ repo, photoStore });

    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'Manual');
    await screen.findByDisplayValue('Manual');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(async () => expect(await repo.findById('fixed-id')).not.toBeNull());
    expect(photoStore.persisted).toEqual([]);
    expect((await repo.findById('fixed-id'))?.photoUri).toBeUndefined();
  });
});
