import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { InMemorySettingsRepository } from '../../test-support/in-memory-settings-repository';
import { SettingsProvider, useSettings } from './settings-context';

function wrapper(repo: InMemorySettingsRepository) {
  return ({ children }: { children: ReactNode }) => (
    <SettingsProvider repository={repo}>{children}</SettingsProvider>
  );
}

describe('useSettings', () => {
  it('loads settings from the repository', async () => {
    const repo = new InMemorySettingsRepository({ reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [7, 1] });
    const { result } = await renderHook(() => useSettings(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.settings).toEqual({ reminderTime: { hour: 8, minute: 30 }, defaultReminderDaysBefore: [7, 1] });
  });

  it('save persists then updates the in-memory settings (persist-first)', async () => {
    const repo = new InMemorySettingsRepository();
    const { result } = await renderHook(() => useSettings(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current).toBeTruthy());
    const next = { reminderTime: { hour: 20, minute: 0 }, defaultReminderDaysBefore: [30] };
    await act(async () => { await result.current.save(next); });
    expect(await repo.load()).toEqual(next);
    expect(result.current.settings).toEqual(next);
  });

  it('leaves settings unchanged when persisting fails', async () => {
    const repo = new InMemorySettingsRepository();
    jest.spyOn(repo, 'save').mockRejectedValue(new Error('disk'));
    const { result } = await renderHook(() => useSettings(), { wrapper: wrapper(repo) });
    await waitFor(() => expect(result.current).toBeTruthy());
    const before = result.current.settings;
    await act(async () => {
      await expect(
        result.current.save({ reminderTime: { hour: 1, minute: 1 }, defaultReminderDaysBefore: [1] }),
      ).rejects.toThrow('disk');
    });
    expect(result.current.settings).toEqual(before);
  });

  it('throws when used outside the provider', async () => {
    await expect(renderHook(() => useSettings())).rejects.toThrow(
      'useSettings must be used within a SettingsProvider',
    );
  });
});
