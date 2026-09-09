/**
 * Game events produced by the log parser. Where they go is up to the configured
 * sinks: the notifier itself knows nothing about its consumers.
 */
export enum GameEventType {
    PlayerConnecting = 'playerConnecting',
    PlayerJoined = 'playerJoined',
    PlayerLeft = 'playerLeft',
    PlayerDied = 'playerDied',
    PlayerRespawned = 'playerRespawned',
    ServerStarted = 'serverStarted',
    ServerStopped = 'serverStopped',
    NewDay = 'newDay',
    RandomEvent = 'randomEvent',
    NetworkTrouble = 'networkTrouble',
}

export interface GameEventInput {
    /** uuid; stable across sinks, so a consumer can drop duplicates from retries */
    clientId: string;
    type: GameEventType;
    /** ISO-8601 UTC */
    occurredAt: string;
    /** Localized notification text; absent = the event is not worth announcing */
    message?: string;
    steamId?: string;
    playerName?: string;
    characterName?: string;
    world?: string;
    payload?: Record<string, unknown>;
}

/** What a log handler provides; identity and time are stamped by the publisher */
export type PublishInput = Omit<GameEventInput, 'clientId' | 'occurredAt'>;

/** Hand an event to every configured sink (collected instead of sent in test mode) */
export type Publish = (event: PublishInput) => void;

/**
 * A destination for events. Sinks are fire-and-forget: publish never blocks the
 * log reader, delivery happens in the background.
 */
export interface EventSink {
    /** For log lines only */
    readonly name: string;
    publish(event: GameEventInput): void;
    /** Finish what is queued; called on shutdown */
    flush(): Promise<void>;
    /** Cancel timers; an explicit flush() still works afterwards */
    stop(): void;
}
