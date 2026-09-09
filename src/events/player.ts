import i18next from 'i18next';
import { EventType, LogEvent } from './types';
import { GameEventType } from '../sinks';
import { CharacterState, Context, PlayerState } from '../domain/context';
import { completeConnection } from '../domain/session';
import { displayName } from '../users';

// "Got character ZDOID from <char> : <owner>:<id>"; owner 0 means the character died
const CHARACTER_ZDOID = /ZDOID from ([^:]+) : ([0-9]+):([0-9]+)/;

/** Steam identity of the character's owner, when the join was seen. */
function ownerOf(
    context: Context,
    charName: string
): { steamId: string; playerName: string } | Record<string, never> {
    const player = context.findPlayer((p) => p.character?.name === charName);
    return player ? { steamId: player.steamId, playerName: displayName(player) } : {};
}

export const playerEvents: LogEvent[] = [
    {
        type: EventType.CHARACTER_ZDOID,
        pattern: CHARACTER_ZDOID,
        handle: async ({ app, match }) => {
            const [, charName, zdoid] = match;
            const { context } = app;

            // First ZDOID after a connection belongs to the earliest connecting player
            const connecting = context.findPlayerByState(PlayerState.Connecting);
            if (connecting) {
                await completeConnection(app, connecting, charName, zdoid);
                return;
            }

            const character = context.getOrCreateCharacter(charName);
            if (zdoid === '0') {
                app.publish({
                    type: GameEventType.PlayerDied,
                    characterName: charName,
                    ...ownerOf(context, charName),
                    message: i18next.t('player.died', { charName }),
                });
                character.state = CharacterState.Dead;
            } else if (character.state === CharacterState.Dead) {
                // A dead character receiving a new ZDOID has respawned
                app.publish({
                    type: GameEventType.PlayerRespawned,
                    characterName: charName,
                    ...ownerOf(context, charName),
                    message: i18next.t('player.respawned', { charName }),
                });
                character.state = CharacterState.Alive;
            }
        },
    },
];
