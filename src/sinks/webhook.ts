import axios from 'axios';
import i18next from 'i18next';
import { WebhookSinkConfig } from '../types/types';
import { EventSink, GameEventInput } from './types';

/** Queue size beyond which the oldest events are dropped */
const QUEUE_CAP = 1000;
/** Queue size that triggers a flush right away instead of waiting for the timer */
const FLUSH_THRESHOLD = 50;
/** Events per request */
const MAX_BATCH = 200;
const DEFAULT_BATCH_MS = 2000;
const BACKOFF_INITIAL_MS = 2000;
const BACKOFF_MAX_MS = 60000;

/** Network trouble, server errors and rate limiting are worth another try */
function isRetryable(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
        return true;
    }
    const status = error.response?.status;
    return status === undefined || status === 429 || status >= 500;
}

function describeError(error: unknown): string {
    if (axios.isAxiosError(error) && error.response) {
        const { status, statusText } = error.response;
        return `HTTP ${status} ${statusText ?? ''}`.trim();
    }
    return error instanceof Error ? error.message : String(error);
}

/**
 * Posts events to an arbitrary HTTP endpoint as `{"events": [...]}`. What sits on
 * the other end (a control panel, a queue, a homemade script) is not this
 * project's concern: the URL and the headers come from the config.
 *
 * Events are batched, and a failed batch is kept and retried with backoff, so a
 * consumer that is briefly down does not cost the session history.
 */
export function createWebhookSink(config: WebhookSinkConfig, timeout: number): EventSink {
    const batchMs = config.batchMs ?? DEFAULT_BATCH_MS;
    const queue: GameEventInput[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: Promise<void> | null = null;
    let backoffMs = BACKOFF_INITIAL_MS;
    let overflowing = false;
    let stopped = false;

    function clearFlushTimer(): void {
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
    }

    function clearRetryTimer(): void {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
    }

    /** By identity: an overflow may have shifted the queue while the batch was in flight */
    function removeFromQueue(batch: GameEventInput[]): void {
        const sent = new Set(batch);
        const remaining = queue.filter((event) => !sent.has(event));
        queue.length = 0;
        queue.push(...remaining);
    }

    function scheduleRetry(): void {
        if (stopped) {
            return;
        }
        clearFlushTimer();
        clearRetryTimer();
        console.log(i18next.t('log.sinkRetry', { delay: backoffMs / 1000 }));
        retryTimer = setTimeout(() => {
            retryTimer = null;
            void flush();
        }, backoffMs);
        backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
    }

    async function post(batch: GameEventInput[]): Promise<void> {
        await axios.post(
            config.url,
            { events: batch },
            {
                headers: {
                    'Content-Type': 'application/json',
                    ...config.headers,
                },
                timeout,
            }
        );
    }

    /** Send batches until the queue is empty or a request needs a retry. */
    async function drain(): Promise<void> {
        while (queue.length > 0) {
            const batch = queue.slice(0, MAX_BATCH);
            try {
                await post(batch);
            } catch (error) {
                if (isRetryable(error)) {
                    console.error(i18next.t('log.sinkError', { error: describeError(error) }));
                    scheduleRetry();
                    return;
                }
                // Rejected on its merits: retrying the same body will not help
                removeFromQueue(batch);
                console.error(
                    i18next.t('log.sinkDropped', {
                        count: batch.length,
                        error: describeError(error),
                    })
                );
                continue;
            }
            removeFromQueue(batch);
            backoffMs = BACKOFF_INITIAL_MS;
            overflowing = false;
            console.log(i18next.t('log.sinkSent', { count: batch.length }));
        }
    }

    function flush(): Promise<void> {
        clearFlushTimer();
        clearRetryTimer();
        if (inFlight) {
            return inFlight;
        }
        if (queue.length === 0) {
            return Promise.resolve();
        }
        inFlight = drain().finally(() => {
            inFlight = null;
        });
        return inFlight;
    }

    function scheduleFlush(): void {
        // A pending retry picks up everything queued; do not bypass its backoff
        if (stopped || retryTimer) {
            return;
        }
        if (queue.length >= FLUSH_THRESHOLD) {
            void flush();
        } else if (!flushTimer) {
            flushTimer = setTimeout(() => {
                flushTimer = null;
                void flush();
            }, batchMs);
        }
    }

    return {
        name: 'webhook',
        publish(event: GameEventInput): void {
            if (queue.length >= QUEUE_CAP) {
                queue.shift();
                if (!overflowing) {
                    overflowing = true;
                    console.error(i18next.t('log.queueOverflow', { cap: QUEUE_CAP }));
                }
            }
            queue.push(event);
            scheduleFlush();
        },
        flush,
        stop(): void {
            stopped = true;
            clearFlushTimer();
            clearRetryTimer();
        },
    };
}
