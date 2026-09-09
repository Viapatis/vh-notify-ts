import i18next from 'i18next';
import { EventType, LogEvent } from './types';

const VALHEIM_VERSION = /Valheim version:(.+)/;
const LOAD_WORLD = /Load world: (.+)/;
const APPLICATION_QUIT = /OnApplicationQuit/;
const NEW_DAY = /day:([0-9]+)/;
const RANDOM_EVENT = /Random event set:([0-9a-zA-Z_]+)/;

function formatRaidMessage(raid: string): string {
    return i18next.t(`raidEvents.${raid}`, {
        defaultValue: i18next.t('raidEvents.unknown'),
    });
}

export const serverEvents: LogEvent[] = [
    {
        type: EventType.VALHEIM_VERSION,
        pattern: VALHEIM_VERSION,
        handle: async ({ app, match }) => {
            app.context.valheimVersion = match[1].trim();
        },
    },
    {
        type: EventType.LOAD_WORLD,
        pattern: LOAD_WORLD,
        handle: async ({ app, match }) => {
            await app.notify(
                i18next.t('server.started', {
                    version: app.context.valheimVersion,
                    worldName: match[1],
                })
            );
            app.context.resetSession();
        },
    },
    {
        type: EventType.APPLICATION_QUIT,
        pattern: APPLICATION_QUIT,
        handle: async ({ app }) => {
            await app.notify(i18next.t('server.crashed'));
            app.context.resetSession();
        },
    },
    {
        type: EventType.NEW_DAY,
        pattern: NEW_DAY,
        handle: async ({ app, match }) => {
            const day = parseInt(match[1], 10) + 1;
            await app.notify(i18next.t('server.day', { day }));
        },
    },
    {
        type: EventType.RANDOM_EVENT,
        pattern: RANDOM_EVENT,
        handle: async ({ app, match }) => {
            await app.notify(
                i18next.t('server.raidStarted', {
                    eventMessage: formatRaidMessage(match[1]),
                })
            );
        },
    },
];
