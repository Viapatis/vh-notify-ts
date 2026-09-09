export enum PlayerState {
    Disconnected = 'DISCONNECTED',
    /** Announced as connecting, waiting for the first ZDOID */
    Connecting = 'CONNECTING',
    Connected = 'CONNECTED',
    /** Identified as the one leaving, waiting for the line that ends the disconnect */
    Disconnecting = 'DISCONNECTING',
}

export enum CharacterState {
    Alive = 'ALIVE',
    Dead = 'DEAD',
}

/** An in-game character. Exists on its own: a death can be seen without the join. */
export interface Character {
    name: string;
    /** ZDO owner id: "2884701354" in "ZDOID from X : 2884701354:1"; known only when the join was seen */
    zdoid: string | null;
    state: CharacterState;
}

/** A Steam account. Known accounts survive server restarts, session fields do not. */
export interface Player {
    steamId: string;
    /** Steam nickname, persisted in users.json */
    userName: string | null;
    /** PlayFab connection id, crossplay only */
    connectionId: string | null;
    state: PlayerState;
    /** Order of the last state change: concurrent joins are served first come, first served */
    stateSeq: number;
    character: Character | null;
}

/** Everything the notifier remembers between log lines. */
export class Context {
    /** Known Steam accounts by Steam ID */
    readonly players = new Map<string, Player>();
    /** Characters seen since the server started, by name */
    readonly characters = new Map<string, Character>();
    /** PlayFab connection ids that reported network trouble (unstable) */
    readonly connectionIdsWithNetworkTrouble = new Set<string>();
    valheimVersion = 'Not set';
    /** A disconnect started and nobody has been identified as leaving yet */
    disconnectInProgress = false;
    private stateCounter = 0;

    /** Forget session state when the server starts or stops; known accounts stay. */
    resetSession(): void {
        for (const player of this.players.values()) {
            player.state = PlayerState.Disconnected;
            player.connectionId = null;
            player.character = null;
        }
        this.characters.clear();
        this.connectionIdsWithNetworkTrouble.clear();
        this.disconnectInProgress = false;
    }

    getOrCreatePlayer(steamId: string): Player {
        let player = this.players.get(steamId);
        if (!player) {
            player = {
                steamId,
                userName: null,
                connectionId: null,
                state: PlayerState.Disconnected,
                stateSeq: 0,
                character: null,
            };
            this.players.set(steamId, player);
        }
        return player;
    }

    getOrCreateCharacter(name: string): Character {
        let character = this.characters.get(name);
        if (!character) {
            character = { name, zdoid: null, state: CharacterState.Alive };
            this.characters.set(name, character);
        }
        return character;
    }

    setPlayerState(player: Player, state: PlayerState): void {
        player.state = state;
        player.stateSeq = ++this.stateCounter;
    }

    findPlayer(predicate: (player: Player) => boolean): Player | null {
        for (const player of this.players.values()) {
            if (predicate(player)) {
                return player;
            }
        }
        return null;
    }

    /** The player that entered the state earliest, or null. */
    findPlayerByState(state: PlayerState): Player | null {
        let earliest: Player | null = null;
        for (const player of this.players.values()) {
            if (
                player.state === state &&
                (!earliest || player.stateSeq < earliest.stateSeq)
            ) {
                earliest = player;
            }
        }
        return earliest;
    }

    findPlayerByZdoid(zdoid: string | null): Player | null {
        if (!zdoid) {
            return null;
        }
        return this.findPlayer((p) => p.character?.zdoid === zdoid);
    }

    findPlayerByConnectionId(connectionId: string): Player | null {
        return this.findPlayer((p) => p.connectionId === connectionId);
    }
}
