import i18next from 'i18next';
import { EventType, LogEvent } from './types';
import { describePlayer } from '../domain/session';

// Unstable: crossplay-only heuristics, reported to the log rather than to the chat
const RESUME_TX = /Resume TX on playfab\/([0-9a-zA-Z_]+)/;
const PLAYFAB_TOKEN_REFRESH = /Update PlayFab entity token/;

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

            const player = context.findPlayerByConnectionId(connectionId);
            app.log(
                player
                    ? i18next.t('log.networkTroubleDetected', describePlayer(player))
                    : i18next.t('log.networkTroubleDetectedUnknown', { connectionId })
            );
        },
    },
    {
        type: EventType.NETWORK_TROUBLE_RESOLVED,
        pattern: PLAYFAB_TOKEN_REFRESH,
        handle: async ({ app }) => {
            const { context } = app;
            for (const connectionId of context.connectionIdsWithNetworkTrouble) {
                const player = context.findPlayerByConnectionId(connectionId);
                app.log(
                    player
                        ? i18next.t('log.networkTroubleResolved', describePlayer(player))
                        : i18next.t('log.networkTroubleResolvedUnknown', { connectionId })
                );
            }
            context.connectionIdsWithNetworkTrouble.clear();
        },
    },
];
