import i18next from 'i18next';
import { App } from '../app';
import { CharacterState, Player, PlayerState } from './context';
import { displayName, fetchUserName } from '../users';

/**
 * A player started connecting: resolve the nickname, announce it and wait
 * for the first ZDOID of this player. Shared by the PlayFab (crossplay)
 * and native Steam log formats, which may both appear for one connection.
 */
export async function startConnection(
    app: App,
    steamId: string,
    connectionId: string | null = null
): Promise<void> {
    const { context } = app;
    const player = context.getOrCreatePlayer(steamId);
    if (connectionId) {
        player.connectionId = connectionId;
    }

    if (player.state === PlayerState.Connecting) {
        return;
    }

    app.log(i18next.t('log.steamIdDetected', { steamId }));

    if (!player.userName) {
        await fetchUserName(app, player);
    }

    await app.notify(
        i18next.t('player.connecting', { userName: displayName(player) })
    );
    context.setPlayerState(player, PlayerState.Connecting);
}

/** First ZDOID after a connection: bind the character to the connecting player. */
export async function completeConnection(
    app: App,
    player: Player,
    charName: string,
    zdoid: string
): Promise<void> {
    const { context } = app;
    const character = context.getOrCreateCharacter(charName);
    character.zdoid = zdoid;
    character.state = CharacterState.Alive;
    player.character = character;

    await app.notify(
        i18next.t('player.connected', {
            userName: displayName(player),
            charName,
        })
    );
    context.setPlayerState(player, PlayerState.Connected);
}

/**
 * Announce a disconnect and close the pending disconnect.
 * player === null means we never learned who it was.
 */
export async function finishDisconnect(
    app: App,
    player: Player | null
): Promise<void> {
    const { context } = app;
    if (player?.character) {
        await app.notify(
            i18next.t('player.disconnected', {
                charName: player.character.name,
                userName: displayName(player),
            })
        );
        context.characters.delete(player.character.name);
        player.character = null;
    } else {
        await app.notify(i18next.t('player.disconnectedUnknown'));
    }
    if (player) {
        context.setPlayerState(player, PlayerState.Disconnected);
    }
    app.log(i18next.t('log.disconnectEventEnded'));
    context.disconnectInProgress = false;
}

/** Nickname, character name and Steam ID for log messages about a player. */
export function describePlayer(player: Player): {
    userName: string;
    charName: string;
    steamId: string;
} {
    return {
        userName: displayName(player),
        charName: player.character?.name ?? i18next.t('player.unknownCharacter'),
        steamId: player.steamId,
    };
}
