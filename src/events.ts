import { Config, Context, Event, EventType, PlayerState } from './types/types';
import { send } from './utils/telegram.utils';
import { addUserName, getUserName } from './utils/user.utils';
import { formatEventMessage } from './utils/event.utils';
import i18next from 'i18next';

// Regular expressions
const ZDOID_REGEX = /ZDOID from ([^:]+) : ([0-9]+):([0-9]+)/;
const DEATH_REGEX = /: 0:/;

const DESTROY_ZDOID_REGEX = /Destroying abandoned non persistent zdo ([0-9]+):/;
const VALHEIM_VERSION_REGEX = /Valheim version:(.+)/;
const LOAD_WORLD_REGEX = /Load world: (.+)/;
const DAY_REGEX = /day:([0-9]+)/;
const RANDOM_EVENT_REGEX = /Random event set:([0-9a-zA-Z_]+)/;
const USER_CONNECTION_ID =
    /PlayFab socket with remote ID playfab\/([0-9a-zA-Z_]+) received local Platform ID Steam_([0-9]+)/;
const USER_NETWORK_TROUBLE_DETECTED = /Resume TX on playfab\/([0-9a-zA-Z_]+)/;
const UPDATE_PLAYFAB_TOKEN_REGEX = /Update PlayFab entity token/;
const PLAYER_CONNECTION_LOST_SERVER_REGEX = /Player connection lost server|Update PlayFab entity token/;
// Native Steam networking (server started without -crossplay): no PlayFab socket lines at all
const STEAM_CONNECTION_REGEX = /Got connection SteamID ([0-9]+)/;
const STEAM_SOCKET_CLOSED_REGEX = /Closing socket ([0-9]+)/;

/**
 * Player connection started: resolve the user name, announce it and arm the
 * "first ZDOID belongs to this Steam ID" flag. Shared by the PlayFab
 * (crossplay) and native Steam log formats.
 */
async function startConnection({
    context,
    config,
    steamId,
}: {
    context: Context;
    config: Config;
    steamId: string;
}): Promise<void> {
    // Both formats may appear for the same connection — announce once
    if (context.connectFlag && context.currentSteamId === steamId) {
        return;
    }

    console.log(i18next.t('log.steamIdDetected', { steamId }));

    // If this is a new player, get their name
    if (!context.userNamesBySteamID[steamId]) {
        await addUserName({ context, config, steamId });
    }

    const userName = getUserName({ context, steamId });

    await send({
        message: i18next.t('player.connecting', { userName }),
        config,
    });

    // Set flag that we're now expecting the first ZDOID for this Steam ID
    context.connectFlag = true;
    context.currentSteamId = steamId;
}

/**
 * Announce a disconnect and reset the disconnect tracking state.
 * charName === null means we never learned who it was.
 */
async function finishDisconnect({
    context,
    config,
    charName,
    steamId,
}: {
    context: Context;
    config: Config;
    charName: string | null;
    steamId: string | null;
}): Promise<void> {
    if (charName) {
        const userName = steamId
            ? getUserName({ context, steamId })
            : i18next.t('player.unknownSteamId');
        await send({
            message: i18next.t('player.disconnected', { charName, userName }),
            config,
        });
        // Update character state (not on server)
        context.playerStates[charName] = PlayerState.Disconnected;
    } else {
        await send({
            message: i18next.t('player.disconnectedUnknown'),
            config,
        });
    }
    console.log(i18next.t('log.disconnectEventEnded'));
    context.disconnectEvent = false;
    context.disconnectingChar = null;
    context.disconnectingZdoId = null;
}

function findSteamIdByZdoid(context: Context, zdoid: string | null): string | null {
    if (!zdoid) {
        return null;
    }
    for (const steamId in context.ZDOIDBySteamID) {
        if (context.ZDOIDBySteamID[steamId] === zdoid) {
            return steamId;
        }
    }
    return null;
}

export const events: Event[] = [
    {
        pattern: /ZDOID/,
        type: EventType.ZDOID,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            const zdoidMatch = line.match(ZDOID_REGEX);
            if (zdoidMatch) {
                const charName = zdoidMatch[1];
                const playerZdoid = zdoidMatch[2];

                //First ZDOID event when character connects to server
                if (context.connectFlag) {
                    // Save connection between ZDOID and character name
                    context.charNamesByZDOID[playerZdoid] = charName;

                    if (context.currentSteamId) {
                        context.ZDOIDBySteamID[context.currentSteamId] =
                            playerZdoid;
                        const userName = getUserName({
                            context,
                            steamId: context.currentSteamId,
                        });

                        // Set character state as "alive"
                        context.playerStates[charName] = PlayerState.Alive;

                        // Send connection message
                        await send({
                            message: i18next.t('player.connected', {
                                userName,
                                charName,
                            }),
                            config,
                        });

                        // Reset flag and current Steam ID after processing
                        context.connectFlag = false;
                        context.currentSteamId = null;
                    }
                } else {
                    if (charName) {
                        // line ending match on 0:0 does not seem to work, this does
                        if (DEATH_REGEX.test(line)) {
                            await send({
                                message: i18next.t('player.died', { charName }),
                                config,
                            });
                            // Set character state as "dead"
                            context.playerStates[charName] = PlayerState.Dead;
                        } else if (
                            context.playerStates[charName] === PlayerState.Dead
                        ) {
                            // If character was dead and received a new ZDOID, means they respawned
                            await send({
                                message: i18next.t('player.respawned', {
                                    charName,
                                }),
                                config,
                            });
                            // Update character state to "alive"
                            context.playerStates[charName] = PlayerState.Alive;
                        }
                    }
                }
            }
        },
    },
    {
        pattern: USER_NETWORK_TROUBLE_DETECTED,
        type: EventType.USER_NETWORK_TROUBLE_DETECTED,
        process: async ({ config, context, line }) => {
            const userConnectionTroubleMatch = line.match(
                USER_NETWORK_TROUBLE_DETECTED
            );
            if (userConnectionTroubleMatch) {
                const currentConnectionId = userConnectionTroubleMatch[1];

                // Check if this connection ID doesn't already have network problems
                if (
                    !context.connectionIDsWithNetworkTrouble.has(
                        currentConnectionId
                    )
                ) {
                    const steamIDEntry = Object.entries(
                        context.playerConnectionIDBySteamID
                    ).find(
                        ([steamID, connectionId]) =>
                            connectionId === currentConnectionId
                    );

                    if (steamIDEntry) {
                        const steamID = steamIDEntry[0];
                        const userName = getUserName({
                            context,
                            steamId: steamID,
                        });
                        const zdoid = context.ZDOIDBySteamID[steamID];
                        const charName = zdoid
                            ? context.charNamesByZDOID[zdoid]
                            : null;

                        console.log({
                            message: i18next.t('log.networkTroubleDetected', {
                                userName,
                                charName:
                                    charName ||
                                    i18next.t('player.unknownCharacter'),
                                steamId: steamID,
                            }),
                            config,
                        });
                    } else {
                        console.log({
                            message: i18next.t('log.networkTroubleDetectedUnknown', {
                                connectionId: currentConnectionId,
                            }),
                            config,
                        });
                    }

                    // Add connection ID to the list with network problems
                    context.connectionIDsWithNetworkTrouble.add(
                        currentConnectionId
                    );
                }
            }
        },
    },

    {
        pattern: /ZRpc timeout detected|RPC_Disconnect/,
        type: EventType.USER_DISCONNECT_START,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            context.disconnectEvent = true;
            console.log(i18next.t('log.disconnectEventStarted'));
        },
    },
    {
        pattern: /Destroying abandoned/,
        type: EventType.USER_DISCONNECT_INFO,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            const destroyMatch = line.match(DESTROY_ZDOID_REGEX);
            if (destroyMatch && context.disconnectEvent) {
                // Get ZDOID of the disconnecting character
                context.disconnectingZdoId = destroyMatch[1];
                // If we know the character name with this ZDOID, remember it
                if (context.charNamesByZDOID[context.disconnectingZdoId]) {
                    context.disconnectingChar =
                        context.charNamesByZDOID[context.disconnectingZdoId];
                }
            }
        },
    },
    {
        pattern: PLAYER_CONNECTION_LOST_SERVER_REGEX,
        type: EventType.USER_DISCONNECT_END,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            // Only process if we have an active disconnect event
            if (context.disconnectEvent) {
                await finishDisconnect({
                    context,
                    config,
                    charName: context.disconnectingChar,
                    steamId: findSteamIdByZdoid(
                        context,
                        context.disconnectingZdoId
                    ),
                });
            }
            // If no active disconnect event, ignore this "Player connection lost"
        },
    },
    {
        pattern: /day:/,
        type: EventType.DAY,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            const dayMatch = line.match(DAY_REGEX);
            if (dayMatch) {
                const day = parseInt(dayMatch[1]) + 1;
                await send({
                    message: i18next.t('server.day', { day }),
                    config,
                });
            }
        },
    },
    {
        pattern: /Load world/,
        type: EventType.LOAD_WORLD,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            const worldMatch = line.match(LOAD_WORLD_REGEX);
            if (worldMatch) {
                const worldName = worldMatch[1];
                await send({
                    message: i18next.t('server.started', {
                        version: context.valheimVersion,
                        worldName,
                    }),
                    config,
                });

                // Reset all character states when server loads
                context.playerStates = {};
            }
        },
    },
    {
        pattern: /OnApplicationQuit/,
        type: EventType.ON_APPLICATION_QUIT,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            await send({
                message: i18next.t('server.crashed'),
                config,
            });

            // Reset all character states when server shuts down
            context.playerStates = {};
        },
    },
    {
        pattern: /Random event/,
        type: EventType.RANDOM_EVENT,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            const eventMatch = line.match(RANDOM_EVENT_REGEX);
            if (eventMatch) {
                const event = eventMatch[1];
                const eventMsg = formatEventMessage(event);
                await send({
                    message: i18next.t('server.raidStarted', {
                        eventMessage: eventMsg,
                    }),
                    config,
                });
            }
        },
    },
    {
        pattern: /Valheim version/,
        type: EventType.VALHEIM_VERSION,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            const versionMatch = line.match(VALHEIM_VERSION_REGEX);
            if (versionMatch) {
                context.valheimVersion = versionMatch[1].trim();
            }
        },
    },
    {
        pattern: UPDATE_PLAYFAB_TOKEN_REGEX,
        type: EventType.UPDATE_PLAYFAB_TOKEN,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            // If there are connection IDs with network problems, report their resolution
            if (context.connectionIDsWithNetworkTrouble.size > 0) {
                for (const connectionId of context.connectionIDsWithNetworkTrouble) {
                    const steamIDEntry = Object.entries(
                        context.playerConnectionIDBySteamID
                    ).find(([steamID, connId]) => connId === connectionId);

                    if (steamIDEntry) {
                        const steamID = steamIDEntry[0];
                        const userName = getUserName({
                            context,
                            steamId: steamID,
                        });
                        const zdoid = context.ZDOIDBySteamID[steamID];
                        const charName = zdoid
                            ? context.charNamesByZDOID[zdoid]
                            : null;

                        console.log({
                            message: i18next.t('log.networkTroubleResolved', {
                                userName,
                                charName:
                                    charName ||
                                    i18next.t('player.unknownCharacter'),
                                steamId: steamID,
                            }),
                            config,
                        });
                    } else {
                        await send({
                            message: i18next.t('log.networkTroubleResolvedUnknown', {
                                connectionId: connectionId,
                            }),
                            config,
                        });
                    }
                }

                // Clear the list of connection IDs with network problems
                context.connectionIDsWithNetworkTrouble.clear();
            }
        },
    },
    {
        pattern: USER_CONNECTION_ID,
        type: EventType.CONNECTION_AND_STEAM_ID,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            // Handle PlayFab socket connection (contains both connection ID and Steam ID)
            const connectionIDMatch = line.match(USER_CONNECTION_ID);
            if (connectionIDMatch) {
                const connectionId = connectionIDMatch[1];
                const steamId = connectionIDMatch[2];
                context.playerConnectionIDBySteamID[steamId] = connectionId;
                await startConnection({ context, config, steamId });
            }
        },
    },
    {
        pattern: STEAM_CONNECTION_REGEX,
        type: EventType.STEAM_CONNECTION,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            // Native Steam connection (no -crossplay): "Got connection SteamID <id>"
            const steamMatch = line.match(STEAM_CONNECTION_REGEX);
            if (steamMatch) {
                await startConnection({ context, config, steamId: steamMatch[1] });
            }
        },
    },
    {
        pattern: STEAM_SOCKET_CLOSED_REGEX,
        type: EventType.STEAM_SOCKET_CLOSED,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            // Native Steam disconnect (no -crossplay): "Closing socket <steamId>".
            // There is no "Player connection lost server" line in this mode,
            // but the Steam ID is right in the line, so we don't depend on
            // the RPC_Disconnect / Destroying abandoned zdo bookkeeping.
            const closedMatch = line.match(STEAM_SOCKET_CLOSED_REGEX);
            if (!closedMatch) {
                return;
            }
            const steamId = closedMatch[1];

            // Connection dropped before the character spawned — just disarm
            if (context.connectFlag && context.currentSteamId === steamId) {
                context.connectFlag = false;
                context.currentSteamId = null;
            }

            const zdoid = context.ZDOIDBySteamID[steamId];
            const charName =
                (zdoid && context.charNamesByZDOID[zdoid]) ||
                context.disconnectingChar;

            if (charName || context.disconnectEvent) {
                await finishDisconnect({ context, config, charName, steamId });
            }
            // Unknown socket without a pending disconnect (e.g. failed handshake) — ignore
        },
    },
];

export function getEvents(line: string): Event[]  {
    return events.filter((event) => event.pattern.test(line)) 
}
