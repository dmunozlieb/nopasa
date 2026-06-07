import * as Crypto from 'expo-crypto';
import type { IdGenerator } from '../../domain/deadline/deadline.factory';

/** Production IdGenerator backed by expo-crypto's RFC-4122 randomUUID. */
export const expoCryptoIdGenerator: IdGenerator = () => Crypto.randomUUID();
