import { App } from '../app';

export enum EventType {
    PLAYFAB_CONNECTION = 'PLAYFAB_CONNECTION', // crossplay (PlayFab) mode
    STEAM_CONNECTION = 'STEAM_CONNECTION', // native Steam mode (no -crossplay)
    CHARACTER_ZDOID = 'CHARACTER_ZDOID',
    DISCONNECT_START = 'DISCONNECT_START',
    DISCONNECT_INFO = 'DISCONNECT_INFO',
    DISCONNECT_END = 'DISCONNECT_END',
    STEAM_SOCKET_CLOSED = 'STEAM_SOCKET_CLOSED', // native Steam mode (no -crossplay)
    VALHEIM_VERSION = 'VALHEIM_VERSION',
    LOAD_WORLD = 'LOAD_WORLD',
    APPLICATION_QUIT = 'APPLICATION_QUIT',
    NEW_DAY = 'NEW_DAY',
    RANDOM_EVENT = 'RANDOM_EVENT',
    NETWORK_TROUBLE_DETECTED = 'NETWORK_TROUBLE_DETECTED', // unstable
    NETWORK_TROUBLE_RESOLVED = 'NETWORK_TROUBLE_RESOLVED', // unstable
}

export interface HandlerArgs {
    app: App;
    line: string;
    /** Result of `line.match(event.pattern)`; capture groups are available */
    match: RegExpMatchArray;
}

export type EventHandler = (args: HandlerArgs) => Promise<void>;

/** A recognisable server log line and what to do about it. */
export interface LogEvent {
    type: EventType;
    /** Full pattern; the match is passed to the handler, no re-matching needed */
    pattern: RegExp;
    handle: EventHandler;
}
