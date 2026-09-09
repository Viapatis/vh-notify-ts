import * as fs from 'fs';
import axios from 'axios';
import i18next from 'i18next';
import { App } from './app';
import { Player } from './domain/context';

const STEAM_PERSONA_NAME = /<span class="actual_persona_name">([^<]+)<\/span>/;

/** Load the Steam ID -> nickname map from the users file into the player registry. */
export function loadUserNames({ config, context }: App): void {
    try {
        if (!fs.existsSync(config.users)) {
            console.warn(
                i18next.t('log.userFileWarning', { filename: config.users })
            );
            return;
        }

        const content = fs.readFileSync(config.users, 'utf8');
        try {
            const names = JSON.parse(content) as Record<string, string>;
            for (const [steamId, userName] of Object.entries(names)) {
                context.getOrCreatePlayer(steamId).userName = userName;
            }
        } catch (parseError) {
            console.error(
                i18next.t('log.userParseError', { error: parseError })
            );
        }
    } catch (error) {
        console.error(i18next.t('log.userLoadError', { error }));
    }
}

function saveUserNames({ config, context }: App): void {
    const names: Record<string, string> = {};
    for (const { steamId, userName } of context.players.values()) {
        if (userName) {
            names[steamId] = userName;
        }
    }
    fs.writeFile(config.users, JSON.stringify(names, null, 2), (err) => {
        if (err) {
            console.error(i18next.t('log.userWriteError', { error: err }));
        }
    });
}

/** Scrape the Steam profile page for the nickname and persist it. */
export async function fetchUserName(app: App, player: Player): Promise<void> {
    const { config } = app;
    const { steamId } = player;
    try {
        const response = await axios.get(`${config.steamURL}${steamId}`, {
            timeout: config.timeout,
        });

        const matches = String(response.data).match(STEAM_PERSONA_NAME);
        if (!matches) {
            app.log(i18next.t('log.nameNotFound', { steamId }));
            return;
        }

        player.userName = matches[1];
        app.log(i18next.t('log.nameFound', { name: player.userName }));
        saveUserNames(app);
    } catch (error) {
        console.error(i18next.t('log.usernameError', { error }));
    }
}

/** Nickname for messages, with a fallback for accounts we could not resolve. */
export function displayName(player: Player): string {
    return (
        player.userName ??
        i18next.t('player.unknownUser', { steamId: player.steamId })
    );
}
