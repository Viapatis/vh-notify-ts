import { Config, Context, Event, EventType, PlayerState } from './types/types';
import { send } from './utils/telegram.utils';
import { addUserName, getUserName } from './utils/user.utils';
import { formatEventMessage } from './utils/event.utils';
import i18next from 'i18next';

// Regular expressions
const ZDOID_REGEX = /ZDOID from ([^:]+) : ([0-9]+):([0-9]+)/;
const DEATH_REGEX = /: 0:/;

const STEAM_ID_REGEX = /Steam_([0-9]+)/;
const DESTROY_ZDOID_REGEX = /Destroying abandoned non persistent zdo ([0-9]+):/;
const VALHEIM_VERSION_REGEX = /Valheim version:(.+)/;
const LOAD_WORLD_REGEX = /Load world: (.+)/;
const DAY_REGEX = /day:([0-9]+)/;
const RANDOM_EVENT_REGEX = /Random event set:([0-9a-zA-Z_]+)/;

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
                    context.zdoIdNames[playerZdoid] = charName;

                    if (context.currentSteamId) {
                        context.playerZdoIds[context.currentSteamId] =
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
        pattern: /RPC_Disconnect/,
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
            if (destroyMatch) {
                // Get ZDOID of the disconnecting character
                context.disconnectingZdoId = destroyMatch[1];
                // If we know the character name with this ZDOID, remember it
                if (context.zdoIdNames[context.disconnectingZdoId]) {
                    context.disconnectingChar =
                        context.zdoIdNames[context.disconnectingZdoId];
                }
            }
        },
    },
    {
        pattern: /Player connection lost server/,
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
            if (context.disconnectingChar) {
                let disconnectingSteamId: string | null = null;
                for (const steamId in context.playerZdoIds) {
                    if (
                        context.playerZdoIds[steamId] ===
                        context.disconnectingZdoId
                    ) {
                        disconnectingSteamId = steamId;
                        break;
                    }
                }

                // If we found Steam ID, get the username
                if (disconnectingSteamId) {
                    const disconnectingUser = getUserName({
                        context,
                        steamId: disconnectingSteamId,
                    });
                    // Send disconnection message with character name and username
                    await send({
                        message: i18next.t('player.disconnected', {
                            charName: context.disconnectingChar,
                            userName: disconnectingUser,
                        }),
                        config,
                    });
                } else {
                    // If we didn't find Steam ID, send message with character name only
                    await send({
                        message: i18next.t('player.disconnected', {
                            charName: context.disconnectingChar,
                            userName: i18next.t('player.unknownSteamId'),
                        }),
                        config,
                    });
                }

                // Update character state (not on server)
                context.playerStates[context.disconnectingChar] =
                    PlayerState.Disconnected;
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
        pattern: /Steam_/,
        type: EventType.STEAM_ID,
        process: async ({
            context,
            line,
            config,
        }: {
            context: Context;
            line: string;
            config: Config;
        }) => {
            const steamIdMatch = line.match(STEAM_ID_REGEX);
            if (steamIdMatch) {
                const steamId = steamIdMatch[1];
                console.log(
                    i18next.t('log.steamIdDetected', {
                        steamId: steamId,
                    })
                );

                // If this is a new player, get their name
                if (!context.userNames[steamId]) {
                    await addUserName({
                        context,
                        config,
                        steamId,
                    });
                }

                const userName = getUserName({
                    context,
                    steamId: steamId,
                });
                
                await send({
                    message: i18next.t('player.connecting', { userName }),
                    config,
                });

                // Set flag that we're now expecting the first ZDOID for this Steam ID
                context.connectFlag = true;
                context.currentSteamId = steamId;
            }
        },
    },
];

export function getEvent(line: string): Event | null {
    return events.find((event) => event.pattern.test(line)) || null;
}
