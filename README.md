# Valheim Notify TS

## Supported Notifications

The application monitors the Valheim server log file and sends notifications for the following events:

1. Player joins the server
2. Player disconnects from the server
3. Player (re)spawns
4. Player dies
5. New day begins (when all players sleep)
6. Random world events triggered, see https://valheim.fandom.com/wiki/Events
7. Server startup and world loading
8. Server shutdown

Both server networking modes are supported and auto-detected from the log lines:

- **Native Steam** (server started *without* `-crossplay`): join is detected by `Got connection SteamID <id>`, leave by `Closing socket <id>`
- **Crossplay / PlayFab** (`-crossplay`): join by `PlayFab socket with remote ID playfab/... received local Platform ID Steam_<id>`, leave by `Player connection lost server`

## Setup and Configuration

### Basic Setup

1. Install node and Download the latest release from the releases page
2. Create a configuration file named `config.json` in the same directory as the executable
3. Configure the following parameters:

```json
{
  "language": "ru",
  "logFile": "/home/vhserver/log/console/vhserver-console.log",
  "users": "/home/vhserver/vh-notify-ts/users.json",
  "steamURL": "https://steamcommunity.com/profiles/",
  "timeout": 5000,
  "telegramBotToken": "YOUR_TELEGRAM_BOT_TOKEN",
  "telegramChatID": "YOUR_TELEGRAM_CHAT_ID",
}
```

4. Run the executable
```bash
node /home/vhserver/vh-notify-ts/vh-notify.js &
```
5. To start automatically on boot, add to cron with
```bash 
   crontab -e
```
and then add a line (replace with actual location of the script and node) 

```
@reboot /home/vhserver/node /home/vhserver/vh-notify-ts/vh-notify.js &
```

### Test Mode

The application includes a test mode that allows you to process existing log files without sending actual Telegram messages. This is useful for:
- Testing your configuration
- Reviewing what events would be detected in your logs
- Debugging without spamming your Telegram chat

To run in test mode:
```bash
# Basic test mode - shows summary at the end
node vh-notify.js --test

# Verbose mode - shows messages in real-time
node vh-notify.js --test --verbose

# Save output to files
node vh-notify.js --test --save

# Combined options
node vh-notify.js --test --verbose --save

# Short versions
node vh-notify.js -t -v -s
```

#### Test Mode Options:

**Basic test mode (`--test` or `-t`)**:
- No actual Telegram messages are sent
- Shows summary of all messages at the end
- Statistics are shown (processed lines, telegram messages, log messages)
- The entire log file is processed sequentially

**Verbose mode (`--verbose` or `-v`)**:
- Shows messages in real-time as they are processed
- Telegram messages prefixed with `📤 [TELEGRAM TEST]:`
- Log messages prefixed with `💬 [LOG]:`

**Save output (`--save` or `-s`)**:
- Saves all messages to timestamped files:
  - `test-telegram-messages-YYYY-MM-DDTHH-MM-SS.txt`
  - `test-log-messages-YYYY-MM-DDTHH-MM-SS.txt`

You can also enable test mode options in the configuration file:
```json
{
  "testMode": true,
  "testVerbose": true,
  "testSaveOutput": true
}
```

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
  vh-notify.ts     entry point: config, log tailing, signals
  cli.ts           config.json loading and command line flags
  app.ts           App = config + session context + notify/log channels
  domain/
    context.ts     Player (Steam account, connect/disconnect state) and Character (ZDOID, alive/dead)
    session.ts     connect / disconnect flow shared by both networking modes
  events/          one file per topic; each event = regex + handler
    connection.ts  PlayFab (crossplay) and native Steam joins
    player.ts      character spawn, death, respawn
    disconnect.ts  RPC_Disconnect, abandoned ZDOs, connection lost, socket closed
    server.ts      version, world load, shutdown, new day, raids
    network.ts     network trouble heuristics (unstable, log only)
  notify/          Telegram transport
  test-mode.ts     replays a log file with collected output instead of Telegram
  users.ts         Steam ID -> nickname resolution and users.json
  i18n/            i18next setup and locale files
```

To support a new log line, add an entry to the matching file in `src/events/` (or a new file registered in `src/events/index.ts`). The regex is the full pattern; its capture groups arrive in the handler as `match`. Handlers talk to the outside world only through `app.notify` and `app.log`, which is what makes test mode possible.

## Acknowledgements

This project is inspired by [Valheim Notify](https://github.com/Whiskey24/valheim-notify/tree/main).
