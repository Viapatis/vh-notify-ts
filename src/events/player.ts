import i18next from 'i18next';
import { EventType, LogEvent } from './types';
import { CharacterState, PlayerState } from '../domain/context';
import { completeConnection } from '../domain/session';

// "Got character ZDOID from <char> : <owner>:<id>"; owner 0 means the character died
const CHARACTER_ZDOID = /ZDOID from ([^:]+) : ([0-9]+):([0-9]+)/;

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
                await app.notify(i18next.t('player.died', { charName }));
                character.state = CharacterState.Dead;
            } else if (character.state === CharacterState.Dead) {
                // A dead character receiving a new ZDOID has respawned
                await app.notify(i18next.t('player.respawned', { charName }));
                character.state = CharacterState.Alive;
            }
        },
    },
];
