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

1. Download the latest release from the releases page
2. Create a configuration file named `config.json` in the same directory as the executable
3. Configure the following parameters:

```json
{
  "language": "ru",
  "logFile": "/path/to/valheim/server/log",
  "users": "/path/to/users.json",
  "steamURL": "https://steamcommunity.com/profiles/",
  "timeout": 5000,
  "telegramBotToken": "YOUR_TELEGRAM_BOT_TOKEN",
  "telegramChatID": "YOUR_TELEGRAM_CHAT_ID",
}
```

4. Run the executable
```
node path/to/vh-notify/vh-notify.js &
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
