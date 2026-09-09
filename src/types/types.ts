export enum Language {
    RU = 'ru',
    EN = 'en',
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
