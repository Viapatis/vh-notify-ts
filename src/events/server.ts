import i18next from 'i18next';
import { EventType, LogEvent } from './types';
import { GameEventType } from '../sinks';

const VALHEIM_VERSION = /Valheim version:(.+)/;
// Two shapes, the server picks one by version:
//   up to 1.0.6  "Load world: evpatijworld (evpatijworld)"
//   since 1.0.7  "ZNet.LoadWorld: evpatijworld (evpatijworld), save number 19"
// The name is taken up to the first space or bracket, so the trailing details do not leak into it.
const LOAD_WORLD = /(?:Load world|ZNet\.LoadWorld): ([^\s(]+)/;
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
        // No event of its own: the version travels in the ServerStarted payload
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
            const version = app.context.valheimVersion;
            const worldName = match[1];
            app.publish({
                type: GameEventType.ServerStarted,
                world: worldName,
                payload: { version },
                message: i18next.t('server.started', { version, worldName }),
            });
            app.context.resetSession();
        },
    },
    {
        type: EventType.APPLICATION_QUIT,
        pattern: APPLICATION_QUIT,
        handle: async ({ app }) => {
            app.publish({
                type: GameEventType.ServerStopped,
                message: i18next.t('server.crashed'),
            });
            app.context.resetSession();
        },
    },
    {
        type: EventType.NEW_DAY,
        pattern: NEW_DAY,
        handle: async ({ app, match }) => {
            const day = parseInt(match[1], 10) + 1;
            app.publish({
                type: GameEventType.NewDay,
                payload: { day },
                message: i18next.t('server.day', { day }),
            });
        },
    },
    {
        type: EventType.RANDOM_EVENT,
        pattern: RANDOM_EVENT,
        handle: async ({ app, match }) => {
            const event = match[1];
            app.publish({
                type: GameEventType.RandomEvent,
                payload: { event },
                message: i18next.t('server.raidStarted', {
                    eventMessage: formatRaidMessage(event),
                }),
            });
        },
    },
];
