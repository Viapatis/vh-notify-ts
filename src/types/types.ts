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
    userNames: Record<string, string>;
    playerZdoIds: Record<string, string>;
    zdoIdNames: Record<string, string>;
    playerStates: Record<string, PlayerState>;
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
    STEAM_ID = 'STEAM_ID',
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
