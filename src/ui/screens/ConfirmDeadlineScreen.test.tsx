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
import { ConfirmDeadlineScreen } from './ConfirmDeadlineScreen';

function renderConfirm(repo: InMemoryDeadlineRepository, photoStore: FakePhotoStore, onClose = () => {}) {
  return render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
          <PhotoStoreProvider store={photoStore}>
            <SettingsProvider repository={new InMemorySettingsRepository()}>
              <ConfirmDeadlineScreen photoUri="file:///cache/cam.jpg" onClose={onClose} />
            </SettingsProvider>
          </PhotoStoreProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
}

describe('ConfirmDeadlineScreen', () => {
  it('shows the thumbnail and saves with the stable photoUri', async () => {
    const repo = new InMemoryDeadlineRepository();
    const photoStore = new FakePhotoStore();
    const onClose = jest.fn();
    await renderConfirm(repo, photoStore, onClose);

    expect(screen.getByTestId('deadline-photo-thumbnail')).toBeTruthy();
    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('fixed-id'))?.photoUri).toBe('stable:///0.jpg');
  });
});
