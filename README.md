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
  "player": {
    "joined": "{name} joined the server",
    "disconnected": "{name} disconnected",
    "unknownUser": "Unknown player ({steamId})"
  }
}
```

### User Management

The application automatically resolves Steam IDs to usernames and stores them in the `users.json` file. You can manually edit this file to customize player names, restart required for update.

## Acknowledgements

This project is inspired by [Valheim Notify](https://github.com/Whiskey24/valheim-notify/tree/main).
