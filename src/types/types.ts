export enum Language {
    RU = 'ru',
    EN = 'en',
}

/** Where parsed events are delivered. Add a case here and in src/sinks/index.ts. */
export enum SinkType {
    /** Notification texts straight into a Telegram chat */
    Telegram = 'telegram',
    /** Full events, batched, to any HTTP endpoint */
    Webhook = 'webhook',
}

export interface TelegramSinkConfig {
    type: SinkType.Telegram;
    botToken: string;
    chatId: string;
}

export interface WebhookSinkConfig {
    type: SinkType.Webhook;
    /** Full endpoint URL: the consumer owns the path, this project does not build it */
    url: string;
    /** Extra request headers, typically an auth token */
    headers?: Record<string, string>;
    /** How long events are batched before a request, ms (default 2000) */
    batchMs?: number;
}

export type SinkConfig = TelegramSinkConfig | WebhookSinkConfig;

export interface Config {
    language: Language;
    logFile: string;
    users: string;
    timeout: number;
    steamURL: string;
    /** At least one destination; several may run side by side */
    sinks: SinkConfig[];
    testMode?: boolean;
    testVerbose?: boolean;
    testSaveOutput?: boolean;
}
