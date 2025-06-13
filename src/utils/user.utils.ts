import { Config, Context } from '../types/types';
import * as fs from 'fs';
import axios from 'axios';
import i18next from 'i18next';

/**
 * Load user names from file
 */
export function loadNames({
    context,
    config,
}: {
    context: Context;
    config: Config;
}): void {
    try {
        if (!fs.existsSync(config.users)) {
            console.warn(
                i18next.t('log.userFileWarning', { filename: config.users })
            );
            return;
        }

        const content = fs.readFileSync(config.users, 'utf8');
        try {
            context.userNamesBySteamID = JSON.parse(content);
        } catch (parseError) {
            console.error(
                i18next.t('log.userParseError', { error: parseError })
            );
            context.userNamesBySteamID = {};
        }
    } catch (error) {
        console.error(i18next.t('log.userLoadError', { error }));
    }
}

export async function addUserName({
    context,
    config,
    steamId,
}: {
    context: Context;
    config: Config;
    steamId: string;
}): Promise<void> {
    try {
        const response = await axios.get(`${config.steamURL}${steamId}`, {
            timeout: config.timeout,
        });

        const matches = response.data.match(
            /<span class="actual_persona_name">([^<]+)<\/span>/
        );

        if (matches && matches[1]) {
            console.log(i18next.t('log.nameFound', { name: matches[1] }));
            const name = matches[1];
            context.userNamesBySteamID[steamId] = name;
            fs.writeFile(
                config.users,
                JSON.stringify(context.userNamesBySteamID, null, 2),
                (err) => {
                    if (err) {
                        console.error(
                            i18next.t('log.userWriteError', { error: err })
                        );
                    }
                }
            );
        }else{
            console.log(i18next.t('log.nameNotFound', { steamId }));
        }
    } catch (error) {
        console.error(i18next.t('log.usernameError', { error }));
    }
}

/**
 * Get username from context
 */
export function getUserName({
    context,
    steamId,
}: {
    context: Context;
    steamId: string;
}): string {
    if (context.userNamesBySteamID[steamId]) {
        return context.userNamesBySteamID[steamId];
    }
    return i18next.t('player.unknownUser', { steamId });
}
