import { importErrorMessage, importResultMessage } from './import-messages';

describe('importErrorMessage', () => {
  it('messages the unreadable / not-Nopasa case', () => {
    expect(importErrorMessage('unreadable')).toMatch(/copia de Nopasa/);
  });
  it('messages the unsupported version case', () => {
    expect(importErrorMessage('unsupported-version')).toMatch(/versión no compatible/);
  });
});

describe('importResultMessage', () => {
  it('shows only imported when nothing else applies', () => {
    expect(importResultMessage({ imported: 3, alreadyExisted: 0, invalidCount: 0 })).toBe('Importados 3');
  });
  it('appends already-existed when > 0', () => {
    expect(importResultMessage({ imported: 2, alreadyExisted: 5, invalidCount: 0 })).toBe('Importados 2 · 5 ya existían');
  });
  it('appends invalid when > 0', () => {
    expect(importResultMessage({ imported: 2, alreadyExisted: 0, invalidCount: 1 })).toBe('Importados 2 · 1 no válidos');
  });
  it('appends both in order', () => {
    expect(importResultMessage({ imported: 1, alreadyExisted: 2, invalidCount: 3 })).toBe('Importados 1 · 2 ya existían · 3 no válidos');
  });
});
