import { withTimeout, TimeoutError } from './with-timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise settles before the timeout', async () => {
    const result = withTimeout(Promise.resolve('ok'), 1000);
    await expect(result).resolves.toBe('ok');
  });

  it('rejects with TimeoutError when the timeout elapses first', async () => {
    const never = new Promise<string>(() => {});
    const result = withTimeout(never, 1000);
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    jest.advanceTimersByTime(1000);
    await assertion;
  });

  it('propagates the underlying rejection', async () => {
    const result = withTimeout(Promise.reject(new Error('boom')), 1000);
    await expect(result).rejects.toThrow('boom');
  });
});
