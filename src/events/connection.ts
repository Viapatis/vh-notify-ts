import { EventType, LogEvent } from './types';
import { startConnection } from '../domain/session';

// Crossplay (-crossplay): one line carries both the PlayFab connection id and the Steam ID
const PLAYFAB_CONNECTION =
    /PlayFab socket with remote ID playfab\/([0-9a-zA-Z_]+) received local Platform ID Steam_([0-9]+)/;
// Native Steam networking (no -crossplay): no PlayFab lines at all
const STEAM_CONNECTION = /Got connection SteamID ([0-9]+)/;

export const connectionEvents: LogEvent[] = [
    {
        type: EventType.PLAYFAB_CONNECTION,
        pattern: PLAYFAB_CONNECTION,
        handle: async ({ app, match }) => {
            const [, connectionId, steamId] = match;
            await startConnection(app, steamId, connectionId);
        },
    },
    {
        type: EventType.STEAM_CONNECTION,
        pattern: STEAM_CONNECTION,
        handle: async ({ app, match }) => {
            await startConnection(app, match[1]);
        },
    },
];
