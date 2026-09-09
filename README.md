# Valheim Notify TS

Parses the Valheim dedicated server console log, turns recognised lines into
structured game events and delivers them to whatever you configure: a Telegram
chat, an HTTP endpoint of your own, or both at once.

Each event carries metadata (Steam ID, player and character names, world,
payload) and, when it is worth announcing, a localized notification text. The
project knows nothing about its consumers beyond the sink configuration.

## Recognised Events

| Type               | Log trigger                                          | Fields                                                  | Message |
|--------------------|------------------------------------------------------|---------------------------------------------------------|---------|
| `playerConnecting` | `Got connection SteamID` / PlayFab socket line       | `steamId`, `playerName`                                 | yes     |
| `playerJoined`     | first `ZDOID from <char>` after a connection         | `steamId`, `playerName`, `characterName`                | yes     |
| `playerLeft`       | `Closing socket` / `Player connection lost server`   | `steamId`, `playerName`, `characterName` (when known)   | yes     |
| `playerDied`       | `ZDOID from <char> : 0:0`                            | `characterName`, `steamId`/`playerName` when known      | yes     |
| `playerRespawned`  | new ZDOID for a dead character                       | `characterName`, `steamId`/`playerName` when known      | yes     |
| `serverStarted`    | `Load world: <name>`                                 | `world`, `payload.version`                              | yes     |
| `serverStopped`    | `OnApplicationQuit`                                  | –                                                       | yes     |
| `newDay`           | `day:<n>`                                            | `payload.day`                                           | yes     |
| `randomEvent`      | `Random event set:<name>`                            | `payload.event` (raw name)                              | yes     |
| `networkTrouble`   | `Resume TX on playfab/...` / PlayFab token refresh   | `payload.connectionId`, `payload.resolved`, player if known | no  |

Events without a message are service ones: they never reach a chat, but a
webhook consumer still receives them.

Random event names are mapped to chat texts through `raidEvents` in the locale
files, see https://valheim.fandom.com/wiki/Events.

Both server networking modes are supported and auto-detected from the log lines:

- **Native Steam** (server started *without* `-crossplay`): join is detected by `Got connection SteamID <id>`, leave by `Closing socket <id>`
- **Crossplay / PlayFab** (`-crossplay`): join by `PlayFab socket with remote ID playfab/... received local Platform ID Steam_<id>`, leave by `Player connection lost server`

## Sinks

A sink is a destination for events. Configure as many as you need; they run side
by side and receive the same event object, so a consumer can deduplicate retries
by `clientId`.

### `telegram`

Sends the notification text of an event to a chat via the Bot API. Deliveries
are chained, so the chat reads in the order things happened in the game.

```json
{ "type": "telegram", "botToken": "123456:AA...", "chatId": "-1001234567890" }
```

### `webhook`

Posts full events to any HTTP endpoint. You own the URL and the headers; this
project neither builds paths nor knows what is on the other side.

```json
{
  "type": "webhook",
  "url": "https://example.invalid/games/valheim/events",
  "headers": { "X-Service-Token": "..." },
  "batchMs": 2000
}
```

Request shape:

```
POST <url>
Content-Type: application/json
<your headers>

{ "events": [ GameEventInput, ... ] }
```

```ts
interface GameEventInput {
    clientId: string;           // uuid, idempotency key
    type: GameEventType;        // see the table above
    occurredAt: string;         // ISO-8601 UTC
    message?: string;           // localized notification text; absent = service event
    steamId?: string;
    playerName?: string;
    characterName?: string;
    world?: string;
    payload?: Record<string, unknown>;
}
```

The source of truth is `src/sinks/types.ts`.

Delivery: events are queued in memory (cap 1000, the oldest are dropped on
overflow) and sent after `batchMs` or as soon as 50 are waiting, at most 200 per
request, one request in flight at a time. Network errors, 5xx and 429 keep the
batch and retry with exponential backoff (2 s doubling up to 60 s); other 4xx
responses drop the batch, since retrying a rejected body will not help. On
shutdown the queue is flushed for up to 5 s.

Adding a sink of your own: implement `EventSink` from `src/sinks/types.ts` and
register it in `createSinks` (`src/sinks/index.ts`) under a new `SinkType`.

## Setup and Configuration

Create `config.json` next to `vh-notify.js` (see `config.example.json`):

```json
{
  "language": "ru",
  "logFile": "/path/to/vhserver-console.log",
  "users": "./users.json",
  "timeout": 10000,
  "steamURL": "https://steamcommunity.com/profiles/",
  "sinks": [
    { "type": "telegram", "botToken": "YOUR_BOT_TOKEN", "chatId": "YOUR_CHAT_ID" }
  ]
}
```

| Key        | Required | Meaning                                                       |
|------------|----------|---------------------------------------------------------------|
| `logFile`  | yes      | Valheim console log to follow                                 |
| `users`    | yes      | Steam ID → nickname cache (`users.json`)                      |
| `sinks`    | yes      | Where events go; at least one entry                           |
| `timeout`  | no       | HTTP timeout in ms (sinks and Steam profile requests)         |
| `steamURL` | no       | Steam profile URL prefix used to resolve nicknames            |
| `language` | no       | Locale for notification texts (`ru` default, `en`)            |
| `testMode`, `testVerbose`, `testSaveOutput` | no | Same as the `--test`, `--verbose`, `--save` flags |

Missing or incomplete entries abort the start with a message listing them. The
config holds bot and service tokens, so keep it `chmod 600`.

Upgrading from 1.x: top-level `telegramBotToken` / `telegramChatID` are still
accepted and migrated into a `telegram` sink at load time, with a warning. Move
them into `sinks` when convenient.

### Running it

The process only needs Node and the config next to the bundle, so any supervisor
will do (systemd, Docker, a terminal). Deployment specifics belong to your
install, not to this repository.

### Test Mode

Test mode replays an existing log file and collects the events instead of
delivering them; no network requests are made. Useful for:
- Checking which events a log produces and what they look like
- Debugging the parser without touching any consumer

```bash
# Basic test mode - summary at the end
node vh-notify.js --test

# Verbose mode - every event as one-line JSON while processing
node vh-notify.js --test --verbose

# Save events (JSON) and log lines next to the log file
node vh-notify.js --test --save

# Short versions
node vh-notify.js -t -v -s
```

**Basic test mode (`--test` or `-t`)**:
- Statistics: processed lines, total events, events with a message, log lines, counts per event type
- Summary of all notification messages (`[type] message`) and log lines

**Verbose mode (`--verbose` or `-v`)**:
- Events printed as they are produced, prefixed with `📤 [EVENT]:` (one-line JSON)
- Log messages prefixed with `💬 [LOG]:`

**Save output (`--save` or `-s`)**:
- Writes next to the replayed log file:
  - `test-events-YYYY-MM-DDTHH-MM-SS.json` — the full `GameEventInput[]`
  - `test-log-messages-YYYY-MM-DDTHH-MM-SS.txt`

The config is validated before the mode is chosen, so a valid `sinks` entry must
be present even for a replay (any values will do, nothing is sent).

### Localization

The application supports multiple languages. By default, Russian (ru) is used.

To add or modify localizations:
1. Create or edit JSON files in the `i18n/locales` directory
2. Each file should be named with the language code (e.g., `en.json`, `ru.json`)
3. Follow the existing translation format

Example of a localization file:
```json
{
  "raidEvents": {
    "army_eikthyr": "Eikthyr rallies the creatures of the forest.",
    "unknown": "Oops, unknown event!"
  },
  "player": {
    "connecting": "{{userName}} is connecting",
    "connected": "{{userName}} connected as {{charName}}",
    "unknownUser": "Unknown player ({{steamId}})"
  }
}
```

`raidEvents` maps the name from the `Random event set:<name>` log line to the message shown in the chat; unknown names fall back to `raidEvents.unknown`.

### User Management

The application automatically resolves Steam IDs to usernames and stores them in the `users.json` file. You can manually edit this file to customize player names, restart required for update.

## Project Layout

```
src/
  vh-notify.ts     entry point: config, log tailing, signals, shutdown flush
  cli.ts           config.json loading/validation and command line flags
  app.ts           App = config + session context + publish/log
  sinks/
    types.ts       GameEventType, GameEventInput, EventSink: the event contract
    event.ts       stamps clientId / occurredAt on a handler's event
    index.ts       builds the configured sinks and fans events out to them
    telegram.ts    notification texts into a Telegram chat
    webhook.ts     batching, retry and backoff for an HTTP consumer
  domain/
    context.ts     Player (Steam account, connect/disconnect state) and Character (ZDOID, alive/dead)
    session.ts     connect / disconnect flow shared by both networking modes
  events/          one file per topic; each event = regex + handler
    connection.ts  PlayFab (crossplay) and native Steam joins
    player.ts      character spawn, death, respawn
    disconnect.ts  RPC_Disconnect, abandoned ZDOs, connection lost, socket closed
    server.ts      version, world load, shutdown, new day, raids
    network.ts     network trouble heuristics (unstable, message-less events)
  test-mode.ts     replays a log file with collected events instead of delivery
  users.ts         Steam ID -> nickname resolution and users.json
  i18n/            i18next setup and locale files
```

To support a new log line, add an entry to the matching file in `src/events/` (or a new file registered in `src/events/index.ts`). The regex is the full pattern; its capture groups arrive in the handler as `match`. Handlers talk to the outside world only through `app.publish` and `app.log`, which is what makes test mode possible, and a new event type goes into `GameEventType` first so every sink sees one contract.

## Acknowledgements

This project is inspired by [Valheim Notify](https://github.com/Whiskey24/valheim-notify/tree/main).
