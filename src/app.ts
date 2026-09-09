import { Config } from './types/types';
import { Context } from './domain/context';
import { Publish } from './sinks';

export { Publish };
/** Informational log line (console in production, collected in test mode). */
export type Log = (message: string) => void;

/** Everything a log-event handler needs: config, session state and output. */
export interface App {
    config: Config;
    context: Context;
    /** Structured game event for the configured sinks (collected instead in test mode). */
    publish: Publish;
    log: Log;
}
