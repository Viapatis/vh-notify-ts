import { randomUUID } from 'crypto';
import { GameEventInput, PublishInput } from './types';

/** Stamp a handler's event with its idempotency key and the current time. */
export function createGameEvent(input: PublishInput): GameEventInput {
    return {
        clientId: randomUUID(),
        occurredAt: new Date().toISOString(),
        ...input,
    };
}
