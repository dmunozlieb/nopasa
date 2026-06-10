import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../../domain/settings/settings.schema';
import type { SettingsRepository } from '../../ports/settings-repository';
import { createSettingsRepository } from '../../infrastructure/persistence/sqlite/create-settings-repository';
import { Loading } from '../components/Loading';

interface SettingsContextValue {
  settings: Settings;
  /** Persist-first: stores `next`, then updates in-memory state. Rejects on failure
   *  (state stays equal to what is persisted — no divergence to reconcile). */
  save: (next: Settings) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  /** Inject a ready repository (tests/previews). Omit to build the SQLite one. */
  repository?: SettingsRepository;
  children: ReactNode;
}

export function SettingsProvider({ repository, children }: SettingsProviderProps) {
  const [repo, setRepo] = useState<SettingsRepository | null>(repository ?? null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (repository) return;
    let cancelled = false;
    void (async () => {
      const built = await createSettingsRepository();
      if (!cancelled) setRepo(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    void (async () => {
      let loaded: Settings;
      try {
        loaded = await repo.load();
      } catch {
        loaded = DEFAULT_SETTINGS;
      }
      if (!cancelled) setSettings(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  // Gate like RepositoryProvider: consumers always read real, loaded settings.
  if (!repo || settings === null) return <Loading />;

  const save = async (next: Settings) => {
    await repo.save(next);
    setSettings(next);
  };

  return <SettingsContext.Provider value={{ settings, save }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
