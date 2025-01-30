# Asobi - turn-based game framework - server

A multiplayer turn-based game server for Node.js.

## Installation

```bash
npm install @basementuniverse/asobi-server
```

## Setup

See [jsonpad.md](../examples/jsonpad.md) for instructions on setting up JSONPad.

## Usage

```ts
import { AsobiServer, Game } from '@basementuniverse/asobi-server';

// We need to create an instance of the server...
const server = new AsobiServer({
  /**
   * Your server-side token for jsonpad.io
   *
   * This shouldn't be exposed to the client, so it's safe to give this token
   * write permissions
   */
  jsonpadServerToken: '<YOUR JSONPAD TOKEN>',

  /**
   * The id or pathname of the jsonpad.io list which will contain game sessions
   */
  jsonpadGamesList: '<YOUR JSONPAD LIST PATHNAME>',

  /**
   * The id or pathname of the jsonpad.io list which will contain player tokens
   * and private player state
   */
  jsonpadPlayersList: '<YOUR JSONPAD LIST PATHNAME>',

  /**
   * Optionally define a rate limit for jsonpad.io requests
   *
   * Free and Developer subscription plans have rate limits of 100ms and 50ms
   * respectively (the Enterprise plan has no rate limit), so depending on your
   * plan you might want to set a rate limit here
   *
   * Default is 150, set this to 0 or null to disable rate limiting
   */
  jsonpadRateLimit: 150,

  /**
   * In "turns" mode, each player takes a turn in the order that they joined the game
   *
   * Once all players have played their turn, the game advances to the next round
   *
   * (this is the default mode)
   */
  mode: 'turns',

  /**
   * In "rounds" mode, each player can take their turn in any order during a round
   *
   * Once all players have played their turn, the game advances to the next round
   */
  // mode: 'rounds',

  /**
   * In "free" mode, players can take turns in any order and at any time
   */
  // mode: 'free',

  /**
   * The minimum number of players in each game
   *
   * By default, once a game has this many players it will start
   *
   * However when a game is created we can pass in the number of players for
   * that particular game session (it must be between minPlayers and maxPlayers)
   *
   * Default is 2
   */
  minPlayers: 2,

  /**
   * The maximum number of players in each game
   *
   * Default is 2
   */
  maxPlayers: 2,

  /**
   * Time limit (in seconds) for joining a game
   *
   * The game will start as soon as:
   * - the time limit is reached (if the minimum number of players have joined)
   * - the maximum number of players have joined
   * - the minimum number of players have joined (if the time limit has been reached)
   *
   * Set this to a number to force all games to use this join time limit (it will
   * not be configurable per game)
   *
   * Set this to null to force-disable the join time limit (it will not be
   * configurable per game, and all games will not have a join time limit)
   *
   * Alternatively, set this to an object like:
   *
   * ```
   * {
   *   "default": number, // the default time limit in seconds
   *   "min": number | null, // the minimum time limit in seconds
   *   "max": number | null, // the maximum time limit in seconds
   * }
   * ```
   */
  joinTimeLimit: null,

  /**
   * Time limit (in seconds) for each player turn
   *
   * If no move is made within this time limit, the game advances to the next turn
   *
   * Only used in "turns" mode
   *
   * This can be a number, null, or an object (see joinTimeLimit for details)
   */
  turnTimeLimit: null,

  /**
   * Time limit (in seconds) for each round
   *
   * After this amount of time has elapsed, the game advances to the next round, and
   * any players who haven't made a move will forfeit their move for the current round
   *
   * Only used in "rounds" mode
   *
   * This can be a number, null, or an object (see joinTimeLimit for details)
   */
  roundTimeLimit: null,

  /**
   * Time limit (in seconds) for each game
   *
   * If the game hasn't finished within this time limit, the gameFinished hook is
   * called automatically when this time has elapsed
   *
   * This can be a number, null, or an object (see joinTimeLimit for details)
   */
  gameTimeLimit: null,

  /**
   * An optional JSON Schema for validating "initial game state" data passed
   * from the client when creating a game
   *
   * This can be useful if we want players to be able to customize a game
   * session when they create a new game, e.g. select a map to play on, or set
   * the difficulty etc.
   */
  gameSchema: {
    type: 'object',
  },

  /**
   * An optional JSON Schema for validating "initial player state" data passed
   * from the client when starting or joining a game
   *
   * This can be useful if we want players to be able to customize all or part
   * of their initial state when starting a new game or joining an existing
   * game, e.g. select a character class or avatar, choose their starting
   * weapon etc.
   */
  playerSchema: {
    type: 'object',
  },

  /**
   * An optional JSON Schema for validating move data
   *
   * We can of course validate game data, player data, and move data inside the
   * hooks (see below), but these schemas might be useful as initial validation
   *
   * Further checks (e.g. checking if a move is valid/legal based on the game
   * rules) can be performed in the hooks
   */
  moveSchema: {
    type: 'object',
  },

  /**
   * These functions will be called at specific points in a game's lifecycle
   *
   * All of these hooks are optional, so you can define only the ones you need
   */
  hooks: {
    /**
     * This hook is called after setting up the default routes but before setting
     * up the error handler (which should be setup last)
     *
     * It allows you to define custom routes, middleware, etc.
     */
    setup: (api: Express): void => {
      // Define custom routes here...
    },

    /**
     * A player has created a new game
     *
     * The player who started the game will be in game.players[0], and their
     * initial player state will be in game.players[0].state
     *
     * Initial game state data will be in game.state
     */
    createGame: async (game: Game): Promise<Game> => {
      // Initialize game state here...

      // game.lastEventType will be 'game-created'
      // game.lastEventData will be set to null

      return game;
    },

    /**
     * A player has joined an existing game
     */
    joinGame: async (game: Game, player: Player): Promise<Game> => {
      // Handle player joined here...

      // game.lastEventType will be 'player-joined'
      // game.lastEventData will be set to the player object

      return game;
    },

    /**
     * A player made a move in a game
     */
    move: async (game: Game, player: Player, move: Move): Promise<Game> => {
      // Handle player move and update game state accordingly here...

      // game.lastEventType will be 'player-moved'
      // game.lastEventData will be reset to null before this hook is called
      // then, after this hook returns, the move object will be merged into
      // game.lastEventData, which means we can customize the lastEventData object
      // in this hook

      return game;
    },

    /**
     * A new round has started
     *
     * This will usually be called after all players have taken their turn when
     * using "turns" or "rounds" modes. It will also be called when the round advances
     * due to a turn-timeout (in "turns" mode) or a round-timeout (in "rounds" mode)
     *
     * When using "free" mode, this hook will not be called (since there are no rounds)
     */
    round: async (game: Game): Promise<Game> => {
      // Handle round advanced here...

      // This hook will be called every time the round advances, this could be when
      // all players have taken their turn in "turns" / "rounds" modes, or when a
      // round time limit is reached
      // game.lastEventType will be unchanged (it will most likely be 'player-moved' or
      // 'timed-out')

      // We can usually infer when a round has advanced inside the move hook, so
      // this hook is just for convenience

      return game;
    },

    /**
     * A game was finished
     *
     * This hook will usually be called after a winning move was played, but depending
     * on how the game is set up, it could be e.g. after a certain max number of moves,
     * or when all players except one have been eliminated, or after the game time limit
     * has been reached etc.
     */
    finishGame: async (game: Game): Promise<Game> => {
      // Handle game finished here...

      // game.lastEventType will be 'game-finished'
      // game.lastEventData will remain unchanged (so, if the finishGame hook is called
      // after a winning move, it will contain move data or whatever was set inside the
      // move hook)

      return game;
    },
  },
});

// Then we can start the server listening on port 3000
server.start();

// (we can specify a port number if we want...)
// server.start(80);

// We can stop the server if necessary...
// server.stop();
```

## Types

```ts
type Game = {
  id: string;
  status: GameStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastEventType:
    | 'game-created'
    | 'player-joined'
    | 'player-moved'
    | 'timed-out'
    | 'game-finished';
  lastEventData: any;
  numPlayers: number;
  players: Player[];
  moves: Move[];
  round: number;
  state: any;
  startsAt?: Date | null;
  finishesAt?: Date | null;
  turnFinishesAt?: Date | null;
  roundFinishesAt?: Date | null;
  [key: string]: any;
};

type Player = {
  id: string;
  name: string;
  status: PlayerStatus;
  state?: any;
  hiddenState?: any;
  [key: string]: any;
};

type Move = {
  playerId: string;
  movedAt: Date;
  data?: any;
};

enum GameStatus {
  WAITING_TO_START = 'waiting_to_start',
  STARTED = 'started',
  FINISHED = 'finished',
}

enum PlayerStatus {
  WAITING_FOR_TURN = 'waiting_for_turn',
  TAKING_TURN = 'taking_turn',
  FINISHED = 'finished',
}
```

## A note about hidden player state

For some games, we might want to hide certain parts of a player's state data from other players. For example, in a card game, we might want to hide a player's hand from their opponents.

To achieve this, in the `createGame`, `joinGame`, and `move` hooks, for each player in the game's `players` array we can include a `hiddenState` property in the player object.

If this property is present in the game data when the hook returns, it will be removed.

The current player (the player who is starting the game, joining the game, or currently taking their turn) will still be able to see their own hidden state in responses.

Note that all hidden player state will be hidden from event handler parameters, so if you need to access or modify hidden state when handling a realtime event, you will need to re-fetch the game state using the client's `fetchState()` method. This method takes a player token as an argument, which ensures that a player's hidden state can only be viewed by that player.

## Error handling

You can throw `AsobiServerError` inside hooks to return an error to the client.


```ts
import { AsobiServerError } from '@basementuniverse/asobi-server';

throw new ServerError(
  'Something went wrong...', // error message
  400 // status code
);
```
