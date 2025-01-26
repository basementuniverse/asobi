# Asobi - turn-based game framework - client

A multiplayer turn-based game client for browser games.

## Installation

Using NPM (e.g. for server-side Node.js or client-side use with a bundler like Webpack):

```bash
npm install @basementuniverse/asobi-client
```

To use it in the browser, you can include it directly from a local file or CDN.

```html
<script src="https://cdn.jsdelivr.net/npm/@basementuniverse/asobi-client/build/client.js"></script>
```

_(Note: it is recommended to specify a version number in the URL to ensure that your game doesn't break if a new version is released, e.g. `https://cdn.jsdelivr.net/npm/@basementuniverse/asobi-client@x.y.z/build/client.js`)_

## Usage

```js
// First we need to create an instance of the client...
const client = new AsobiClient({
  /**
   * Your client-side token for jsonpad.io
   *
   * This will be publically visible to anyone who plays your game, so it
   * should be secure
   *
   * i.e. it should have read-only permissions for the games list
   */
  jsonpadClientToken: '<YOUR JSONPAD TOKEN>',

  /**
   * The id or pathname of the jsonpad.io list which will contain game sessions
   */
  jsonpadGamesList: '<YOUR JSONPAD LIST PATHNAME>',

  /**
   * The URL of the Asobi server that this client should connect to
   */
  asobiServerUrl: '<YOUR ASOBI SERVER URL>',
});

// Fetch a list of games
const { page, limit, total, games } = await client.fetchGames({
  // these fields are all optional
  page: 1,
  limit: 10,

  // valid values are: started, finished, status
  order: 'started',

  // valid values are: asc, desc
  direction: 'desc',

  // valid values are: waiting_to_start, started, finished
  status: 'waiting_to_start',
});

// Fetch a game
const game = await client.fetchGame('<GAME ID>');

// Fetch the current state of a game using a player's token
// This will include hidden state for the specified player
const game = await client.fetchState('<GAME ID>', myToken);

// Create a new game with the specified initial state, and join the game
// as the first player
const [game, myToken] = await client.createGame(
  'My Player Name',
  {
    // my player data
  },
  {
    // game data
  }
);

// Join an existing game as the 2nd, 3rd, 4th etc. player
// (up to the max number of players)
const [game, myToken] = await client.joinGame(
  '<GAME ID>',
  'My Player Name',
  {
    // my player data
  }
);

// Make a move in a game
const game = await client.move(
  '<GAME ID>',
  myToken,
  {
    // move data
  }
);

// Handle events
client.addEventListener('game-created', event => {
  const game = event.detail;

  // A new game was started
  // game.lastEventType will be 'game-created'
  // game.lastEventData will be set to null
});

client.addEventListener('player-joined', event => {
  const game = event.detail;

  // A player joined a game
  // game.id will contain the id of the game that the player joined
  // game.lastEventType will be 'player-joined'
  // game.lastEventData will be set to the player object
});

client.addEventListener('player-moved', event => {
  const game = event.detail;

  // A player made a move in a game
  // game.id will contain the id of the game in which the move was made
  // game.lastEventType will usually be 'player-moved', but might be 'game-finished' if the
  // last move caused the game to finish
  // game.lastEventData will be an object containing the move data
  // The server might add further data to lastEventData depending on how it's configured
});

client.addEventListener('timed-out', event => {
  const game = event.detail;

  // The game has been configured with turn or round time limits, and the time limit has been reached
  // game.id will contain the id of the game in which the turn or round timed out
  // game.lastEventType will 'timed-out'
  // game.lastEventData will be set to null
});

client.addEventListener('game-finished', event => {
  const game = event.detail;

  // A game has finished
  // game.id will contain the id of the game that finished
  // game.lastEventType will be 'game-finished'
  // game.lastEventData will be an object containing the move data
  // The server might add further data to lastEventData depending on how it's configured
});
```

See the [Asobi server README](../server/README.md) for a reference of types.

## Number of players, time limits, etc.

The Asobi server can be configured to support games with a fixed number of players, or a range of players.

To set the number of players in a specific game session, set the `numPlayers` property in the game data:

```js
const [game, myToken] = await client.createGame(
  'My Player Name',
  {
    // my player data
  },
  {
    // game data
    numPlayers: 4, // this must be between min and max (as configured on the server)
  }
);
```

The server can also be configured to support time limits for joining a game, making a move, completing a round, and completing the game. These time limits are measured in seconds.

To set time limits for a specific game session, set the `joinTimeLimit`, `turnTimeLimit`, `roundTimeLimit`, and `gameTimeLimit` properties in the game data:

```js
const [game, myToken] = await client.createGame(
  'My Player Name',
  {
    // my player data
  },
  {
    // game data
    joinTimeLimit: 60, // seconds
    turnTimeLimit: 30,
    roundTimeLimit: 300,
    gameTimeLimit: 3600,
  }
);
```

Use `0` or `null` for no time limit. Omit the property to use the server's default time limit.
