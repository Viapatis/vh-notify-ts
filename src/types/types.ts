export enum PlayerState {
    Disconnected = 0,
    Alive = 1,
    Dead = 2,
}

export enum Language {
    RU = 'ru',
    EN = 'en',
}

export interface Context {
    userNamesBySteamID: Record<string, string>;
    ZDOIDBySteamID: Record<string, string>;
    charNamesByZDOID: Record<string, string>;
    playerConnectionIDBySteamID: Record<string, string>;
    playerStates: Record<string, PlayerState>;
    connectionIDsWithNetworkTrouble: Set<string>; // Connection IDs with network issues
    valheimVersion: string;
    connectFlag: boolean;
    disconnectEvent: boolean;
    disconnectingChar: string | null;
    disconnectingZdoId: string | null;
    currentSteamId: string | null;
}

export interface Config {
    language: Language;
    logFile: string;
    users: string;
    timeout: number;
    steamURL: string;
    telegramBotToken: string;
    telegramChatID: string;
    testMode?: boolean;
    testVerbose?: boolean;
    testSaveOutput?: boolean;
}

export enum EventType {
    ZDOID = 'ZDOID',
    USER_DISCONNECT_START = 'USER_DISCONNECT_START',
    USER_DISCONNECT_INFO = 'USER_DISCONNECT_INFO',
    USER_DISCONNECT_END = 'USER_DISCONNECT_END',
    DAY = 'DAY',
    LOAD_WORLD = 'LOAD_WORLD',
    ON_APPLICATION_QUIT = 'ON_APPLICATION_QUIT',
    RANDOM_EVENT = 'RANDOM_EVENT',
    VALHEIM_VERSION = 'VALHEIM_VERSION',
    CONNECTION_AND_STEAM_ID = 'CONNECTION_AND_STEAM_ID',
    UPDATE_PLAYFAB_TOKEN = 'UPDATE_PLAYFAB_TOKEN',

    USER_NETWORK_TROUBLE_DETECTED = 'USER_NETWORK_TROUBLE_DETECTED', //unstable
    USER_NETWORK_TROUBLE_RESOLVED = 'USER_NETWORK_TROUBLE_RESOLVED', //unstable
}

export interface Event {
    pattern: RegExp;
    type: EventType;
    process: (params: {
        context: Context;
        line: string;
        config: Config;
    }) => Promise<void>;
}
