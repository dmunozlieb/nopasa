import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { InMemoryDeadlineRepository } from '../../test-support/in-memory-deadline-repository';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { FakeNotificationScheduler } from '../../test-support/fake-notification-scheduler';
import { FakePhotoStore } from '../../test-support/fake-photo-store';
import { FakeTextRecognizer } from '../../test-support/fake-text-recognizer';
import type { RecognizedText, TextRecognizer } from '../../ports/text-recognizer';
import { RepositoryProvider } from '../repository/repository-context';
import { DeadlineDepsProvider } from '../deadline-deps/deadline-deps-context';
import { NotificationSchedulerProvider } from '../notification-scheduler/notification-scheduler-context';
import { PhotoStoreProvider } from '../photo-store/photo-store-context';
import { TextRecognizerProvider } from '../text-recognizer/text-recognizer-context';
import { SettingsProvider } from '../settings/settings-context';
import { ConfirmDeadlineScreen } from './ConfirmDeadlineScreen';

async function renderConfirm(opts: {
  repo?: InMemoryDeadlineRepository;
  photoStore?: FakePhotoStore;
  recognizer?: TextRecognizer;
  timeoutMs?: number;
  onClose?: () => void;
}) {
  const repo = opts.repo ?? new InMemoryDeadlineRepository();
  const photoStore = opts.photoStore ?? new FakePhotoStore();
  const recognizer = opts.recognizer ?? new FakeTextRecognizer();
  const onClose = opts.onClose ?? (() => {});
  const result = await render(
    <RepositoryProvider repository={repo}>
      <DeadlineDepsProvider generateId={() => 'fixed-id'} clock={{ now: () => new Date(2026, 5, 8) }}>
        <NotificationSchedulerProvider scheduler={new FakeNotificationScheduler()}>
          <PhotoStoreProvider store={photoStore}>
            <TextRecognizerProvider recognizer={recognizer}>
              <SettingsProvider repository={new InMemorySettingsRepository()}>
                <ConfirmDeadlineScreen photoUri="file:///cache/cam.jpg" onClose={onClose} timeoutMs={opts.timeoutMs} />
              </SettingsProvider>
            </TextRecognizerProvider>
          </PhotoStoreProvider>
        </NotificationSchedulerProvider>
      </DeadlineDepsProvider>
    </RepositoryProvider>,
  );
  return { repo, photoStore, recognizer, ...result };
}

const recognized = (result: RecognizedText) => new FakeTextRecognizer({ result });

describe('ConfirmDeadlineScreen', () => {
  it('runs OCR over the photo, then renders the form and a temporary detected-text preview', async () => {
    const recognizer = recognized({ text: 'ITV del coche\nCaduca 11/06/2027', lines: ['ITV del coche', 'Caduca 11/06/2027'] });
    const { recognizer: rec } = await renderConfirm({ recognizer });

    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
    expect((rec as FakeTextRecognizer).calls).toEqual(['file:///cache/cam.jpg']);
    expect(screen.getByTestId('detected-text')).toBeTruthy();
    expect(screen.getByText(/Caduca 11\/06\/2027/)).toBeTruthy();
  });

  it('still shows the thumbnail and saves with the stable photoUri (Block 1 regression)', async () => {
    const onClose = jest.fn();
    const { repo } = await renderConfirm({ recognizer: recognized({ text: 'x', lines: ['x'] }), onClose });

    expect(await screen.findByTestId('deadline-photo-thumbnail')).toBeTruthy();
    fireEvent.changeText(await screen.findByPlaceholderText('Ej. ITV del coche'), 'ITV del coche');
    await screen.findByDisplayValue('ITV del coche');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await repo.findById('fixed-id'))?.photoUri).toBe('stable:///0.jpg');
  });

  it('renders the form (no preview) when OCR returns empty text', async () => {
    await renderConfirm({ recognizer: recognized({ text: '', lines: [] }) });
    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
    expect(screen.queryByTestId('detected-text')).toBeNull();
  });

  it('renders the form and allows manual save when OCR fails (best-effort)', async () => {
    const onClose = jest.fn();
    const recognizer = new FakeTextRecognizer({ error: new Error('ocr failed') });
    const { repo } = await renderConfirm({ recognizer, onClose });

    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
    expect(screen.queryByTestId('detected-text')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('Ej. ITV del coche'), 'Manual');
    await screen.findByDisplayValue('Manual');
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await repo.findById('fixed-id')).not.toBeNull();
  });

  it('falls back to the form when OCR hangs past the timeout (real withTimeout path)', async () => {
    const hanging: TextRecognizer = { recognize: () => new Promise<RecognizedText>(() => {}) };
    await renderConfirm({ recognizer: hanging, timeoutMs: 20 });

    expect(await screen.findByPlaceholderText('Ej. ITV del coche')).toBeTruthy();
    expect(screen.queryByTestId('detected-text')).toBeNull();
  });
});
