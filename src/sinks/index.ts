import i18next from 'i18next';
import { Config, SinkType } from '../types/types';
import { createGameEvent } from './event';
import { createTelegramSink } from './telegram';
import { createWebhookSink } from './webhook';
import { EventSink, Publish, PublishInput } from './types';

export * from './types';
export { createGameEvent } from './event';

/** Build the sinks named in the config; unknown types are rejected at load time. */
export function createSinks(config: Config): EventSink[] {
    return config.sinks.map((sink) => {
        switch (sink.type) {
            case SinkType.Telegram:
                return createTelegramSink(sink, config.timeout);
            case SinkType.Webhook:
                return createWebhookSink(sink, config.timeout);
            default:
                throw new Error(`Unknown sink type: ${JSON.stringify(sink)}`);
        }
    });
}

export interface Publisher {
    publish: Publish;
    flush: () => Promise<void>;
    stop: () => void;
}

/**
 * Fan-out to every sink. The event is stamped once, so all consumers see the same
 * clientId and can deduplicate retries independently.
 */
export function createPublisher(sinks: EventSink[]): Publisher {
    return {
        publish(input: PublishInput): void {
            const event = createGameEvent(input);
            for (const sink of sinks) {
                try {
                    sink.publish(event);
                } catch (error) {
                    // A broken sink must not take the log reader down with it
                    console.error(i18next.t('log.sinkFailed', { sink: sink.name, error }));
                }
            }
        },
        flush: async () => {
            await Promise.all(sinks.map((sink) => sink.flush()));
        },
        stop: () => sinks.forEach((sink) => sink.stop()),
    };
}
