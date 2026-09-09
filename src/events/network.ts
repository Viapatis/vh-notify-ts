import i18next from 'i18next';
import { EventType, LogEvent } from './types';
import { App } from '../app';
import { GameEventType } from '../sinks';
import { describePlayer } from '../domain/session';
import { displayName } from '../users';

// Unstable: crossplay-only heuristics, reported to the log and as message-less events
const RESUME_TX = /Resume TX on playfab\/([0-9a-zA-Z_]+)/;
const PLAYFAB_TOKEN_REFRESH = /Update PlayFab entity token/;

/** Log the change and publish a NetworkTrouble event without a notification text. */
function reportNetworkTrouble(app: App, connectionId: string, resolved: boolean): void {
    const player = app.context.findPlayerByConnectionId(connectionId);
    const key = resolved ? 'networkTroubleResolved' : 'networkTroubleDetected';
    app.log(
        player
            ? i18next.t(`log.${key}`, describePlayer(player))
            : i18next.t(`log.${key}Unknown`, { connectionId })
    );
    app.publish({
        type: GameEventType.NetworkTrouble,
        ...(player ? { steamId: player.steamId, playerName: displayName(player) } : {}),
        payload: { connectionId, resolved },
    });
}

export const networkEvents: LogEvent[] = [
    {
        type: EventType.NETWORK_TROUBLE_DETECTED,
        pattern: RESUME_TX,
        handle: async ({ app, match }) => {
            const { context } = app;
            const connectionId = match[1];
            if (context.connectionIdsWithNetworkTrouble.has(connectionId)) {
                return;
            }
            context.connectionIdsWithNetworkTrouble.add(connectionId);
            reportNetworkTrouble(app, connectionId, false);
        },
    },
    {
        type: EventType.NETWORK_TROUBLE_RESOLVED,
        pattern: PLAYFAB_TOKEN_REFRESH,
        handle: async ({ app }) => {
            const { context } = app;
            for (const connectionId of context.connectionIdsWithNetworkTrouble) {
                reportNetworkTrouble(app, connectionId, true);
            }
            context.connectionIdsWithNetworkTrouble.clear();
        },
    },
];
