import { App } from '../app';
import { LogEvent } from './types';
import { connectionEvents } from './connection';
import { playerEvents } from './player';
import { disconnectEvents } from './disconnect';
import { serverEvents } from './server';
import { networkEvents } from './network';

/**
 * Order matters only where one line matches several events:
 * "Update PlayFab entity token" must end a pending disconnect before the
 * network-trouble bookkeeping runs on it.
 */
export const events: LogEvent[] = [
    ...connectionEvents,
    ...playerEvents,
    ...disconnectEvents,
    ...serverEvents,
    ...networkEvents,
];

export interface EventMatch {
    event: LogEvent;
    match: RegExpMatchArray;
}

export function matchEvents(line: string): EventMatch[] {
    const matches: EventMatch[] = [];
    for (const event of events) {
        const match = line.match(event.pattern);
        if (match) {
            matches.push({ event, match });
        }
    }
    return matches;
}

/** Run every handler whose pattern matches the line, in declaration order. */
export async function processLine(app: App, line: string): Promise<void> {
    for (const { event, match } of matchEvents(line)) {
        await event.handle({ app, line, match });
    }
}
