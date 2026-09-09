import i18next from 'i18next';
import { EventType, LogEvent } from './types';
import { PlayerState } from '../domain/context';
import { finishDisconnect } from '../domain/session';

// Both modes: a disconnect starts with one of these lines and the abandoned
// ZDOs of the leaving character follow. Neither line names the player, so the
// character is resolved through the ZDO owner id.
const DISCONNECT_START = /ZRpc timeout detected|RPC_Disconnect/;
const ABANDONED_ZDO = /Destroying abandoned non persistent zdo ([0-9]+):/;
// Crossplay only: "Player connection lost server" ends the disconnect;
// "Update PlayFab entity token" is the only line that follows when a single
// player was on the server. Native Steam never logs either.
const DISCONNECT_END = /Player connection lost server|Update PlayFab entity token/;
// Native Steam only: the Steam ID is right in the line. The start/info
// bookkeeping above is still used as a fallback for sockets without a
// known character.
const STEAM_SOCKET_CLOSED = /Closing socket ([0-9]+)/;

export const disconnectEvents: LogEvent[] = [
    {
        type: EventType.DISCONNECT_START,
        pattern: DISCONNECT_START,
        handle: async ({ app }) => {
            app.context.disconnectInProgress = true;
            app.log(i18next.t('log.disconnectEventStarted'));
        },
    },
    {
        type: EventType.DISCONNECT_INFO,
        pattern: ABANDONED_ZDO,
        handle: async ({ app, match }) => {
            const { context } = app;
            if (!context.disconnectInProgress) {
                return;
            }
            // The abandoned ZDOs belong to the leaving character
            const player = context.findPlayerByZdoid(match[1]);
            if (player && player.state !== PlayerState.Disconnecting) {
                context.setPlayerState(player, PlayerState.Disconnecting);
            }
        },
    },
    {
        type: EventType.DISCONNECT_END,
        pattern: DISCONNECT_END,
        handle: async ({ app }) => {
            const { context } = app;
            const leaving = context.findPlayerByState(PlayerState.Disconnecting);
            // Without a disconnect in progress this line is noise
            if (leaving || context.disconnectInProgress) {
                await finishDisconnect(app, leaving);
            }
        },
    },
    {
        type: EventType.STEAM_SOCKET_CLOSED,
        pattern: STEAM_SOCKET_CLOSED,
        handle: async ({ app, match }) => {
            const { context } = app;
            const player = context.players.get(match[1]) ?? null;

            // Connection dropped before the character spawned: just disarm
            if (player?.state === PlayerState.Connecting) {
                context.setPlayerState(player, PlayerState.Disconnected);
                return;
            }

            const leaving = player?.character
                ? player
                : context.findPlayerByState(PlayerState.Disconnecting);
            if (leaving || context.disconnectInProgress) {
                await finishDisconnect(app, leaving);
            }
            // Unknown socket without a disconnect in progress (failed handshake): ignore
        },
    },
];
