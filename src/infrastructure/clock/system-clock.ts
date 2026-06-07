import type { Clock } from '../../domain/deadline/deadline.factory';

/** Production Clock backed by the system time. */
export const systemClock: Clock = {
  now(): Date {
    return new Date();
  },
};
