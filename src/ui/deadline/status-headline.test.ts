import { statusHeadline } from './status-headline';

describe('statusHeadline', () => {
  it('composes verb + countdown for future days', () => {
    expect(statusHeadline('Caduca', 4)).toBe('Caduca en 4 días');
    expect(statusHeadline('Vence', 75)).toBe('Vence en 3 meses');
  });

  it('says "{verb} hoy" for today', () => {
    expect(statusHeadline('Se cobra', 0)).toBe('Se cobra hoy');
  });

  it('says "Vencido" for overdue', () => {
    expect(statusHeadline('Caduca', -3)).toBe('Vencido');
  });
});
