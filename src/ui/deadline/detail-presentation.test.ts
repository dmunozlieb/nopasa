import { DeadlineType } from '../../domain/deadline/deadline.schema';
import { detailPresentation } from './detail-presentation';

describe('detailPresentation', () => {
  it('returns complete, non-empty fields for every deadline type', () => {
    for (const type of DeadlineType.options) {
      const p = detailPresentation(type);
      expect(p.verb.length).toBeGreaterThan(0);
      expect(p.consequence.length).toBeGreaterThan(0);
      expect(p.primaryAction.length).toBeGreaterThan(0);
      expect(p.secondaryAction.length).toBeGreaterThan(0);
      expect(p.manage.label.length).toBeGreaterThan(0);
      expect(['RESOLVED', 'CANCELLED']).toContain(p.manage.targetStatus);
    }
  });

  it('maps verbs per type', () => {
    expect(detailPresentation('ITV').verb).toBe('Caduca');
    expect(detailPresentation('INSURANCE').verb).toBe('Vence');
    expect(detailPresentation('SUBSCRIPTION').verb).toBe('Se cobra');
    expect(detailPresentation('WARRANTY').verb).toBe('Termina');
  });

  it('only subscription cancels; the rest resolve', () => {
    expect(detailPresentation('SUBSCRIPTION').manage).toEqual({
      label: 'Marcar como cancelada',
      targetStatus: 'CANCELLED',
    });
    expect(detailPresentation('ITV').manage.targetStatus).toBe('RESOLVED');
    expect(detailPresentation('GAS_INSPECTION').manage.label).toBe('Marcar como hecha');
  });
});
