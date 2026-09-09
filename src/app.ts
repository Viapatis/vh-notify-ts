import { Config } from './types/types';
import { Context } from './domain/context';

/** Send a notification to the chat (Telegram in production, collected in test mode). */
export type Notify = (message: string) => Promise<void>;
/** Informational log line (console in production, collected in test mode). */
export type Log = (message: string) => void;

/** Everything a log-event handler needs: config, session state and output channels. */
export interface App {
    config: Config;
    context: Context;
    notify: Notify;
    log: Log;
}
